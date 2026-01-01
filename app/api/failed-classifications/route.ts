import { NextRequest, NextResponse } from 'next/server';
import { query, ensureFailedClassificationsTable } from '@/lib/database/client';
import { classifyChunkSubject } from '@/lib/subjectClassifier';

/**
 * Extract retry delay from Gemini API error message
 */
function extractRetryDelay(error: any): number | null {
  try {
    const errorStr = JSON.stringify(error);
    const retryMatch = errorStr.match(/Please retry in ([\d.]+)s/i);
    if (retryMatch) {
      const seconds = parseFloat(retryMatch[1]);
      return Math.ceil(seconds * 1000) + 1000;
    }
    
    if (error?.errorDetails) {
      const retryInfo = error.errorDetails.find((d: any) => d['@type']?.includes('RetryInfo'));
      if (retryInfo?.retryDelay) {
        const seconds = parseFloat(retryInfo.retryDelay);
        return Math.ceil(seconds * 1000) + 1000;
      }
    }
  } catch (e) {
    // Ignore parsing errors
  }
  return null;
}

/**
 * GET /api/failed-classifications - View failed classifications
 */
export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set', status: 'not_configured' },
        { status: 400 }
      );
    }

    await ensureFailedClassificationsTable();

    const result = await query<{
      id: number;
      chunk_id: number;
      error_message: string | null;
      failed_at: Date;
      retry_count: number;
      source: string;
      text_preview: string;
    }>(
      `SELECT 
        fc.id,
        fc.chunk_id,
        fc.error_message,
        fc.failed_at,
        fc.retry_count,
        c.source,
        LEFT(c.text, 200) as text_preview
       FROM failed_classifications fc
       JOIN chunks c ON fc.chunk_id = c.id
       ORDER BY fc.failed_at DESC
       LIMIT 100`
    );

    return NextResponse.json({
      status: 'ok',
      failed: result.rows.length,
      chunks: result.rows,
    });
  } catch (error) {
    console.error('❌ Failed to get failed classifications:', error);
    return NextResponse.json(
      {
        error: 'Failed to get failed classifications',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/failed-classifications - Retry failed classifications
 */
export async function PUT(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set', status: 'not_configured' },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY not set', status: 'not_configured' },
        { status: 400 }
      );
    }

    await ensureFailedClassificationsTable();

    // Get failed chunks
    const failedChunks = await query<{ chunk_id: number; text: string }>(
      `SELECT fc.chunk_id, c.text
       FROM failed_classifications fc
       JOIN chunks c ON fc.chunk_id = c.id
       ORDER BY fc.retry_count ASC, fc.failed_at ASC
       LIMIT 15`
    );

    if (failedChunks.rows.length === 0) {
      return NextResponse.json({
        status: 'complete',
        message: 'No failed chunks to retry',
        retried: 0,
      });
    }

    console.log(`🔄 Retrying ${failedChunks.rows.length} failed classifications...`);

    const DELAY_BETWEEN_REQUESTS_MS = 5000;
    let retried = 0;
    let stillFailed = 0;

    for (let i = 0; i < failedChunks.rows.length; i++) {
      const failedChunk = failedChunks.rows[i];
      
      if (i > 0) {
        console.log(`   ⏳ Waiting ${DELAY_BETWEEN_REQUESTS_MS / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
      }

      try {
        const subject = await classifyChunkSubject(failedChunk.text);
        await query('UPDATE chunks SET subject = $1 WHERE id = $2', [subject, failedChunk.chunk_id]);
        await query('DELETE FROM failed_classifications WHERE chunk_id = $1', [failedChunk.chunk_id]);
        retried++;
        console.log(`   ✅ Retried chunk ${failedChunk.chunk_id} as "${subject}" (${retried}/${failedChunks.rows.length})`);
      } catch (error: any) {
        stillFailed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isRateLimit = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('rate limit');
        
        if (isRateLimit) {
          const retryDelay = extractRetryDelay(error);
          if (retryDelay !== null) {
            console.log(`   ⏳ Rate limit for chunk ${failedChunk.chunk_id}, waiting ${retryDelay / 1000}s...`);
            try {
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              const subject = await classifyChunkSubject(failedChunk.text);
              await query('UPDATE chunks SET subject = $1 WHERE id = $2', [subject, failedChunk.chunk_id]);
              await query('DELETE FROM failed_classifications WHERE chunk_id = $1', [failedChunk.chunk_id]);
              retried++;
              stillFailed--;
              console.log(`   ✅ Retried chunk ${failedChunk.chunk_id} after delay as "${subject}"`);
            } catch (retryError: any) {
              const retryErrorMsg = retryError instanceof Error ? retryError.message : String(retryError);
              console.error(`   ❌ Retry failed for chunk ${failedChunk.chunk_id}:`, retryErrorMsg);
              await query(
                `UPDATE failed_classifications 
                 SET error_message = $1, retry_count = retry_count + 1, failed_at = CURRENT_TIMESTAMP
                 WHERE chunk_id = $2`,
                [retryErrorMsg.substring(0, 1000), failedChunk.chunk_id]
              );
            }
          } else {
            console.error(`   ❌ Rate limit for chunk ${failedChunk.chunk_id} but couldn't extract delay`);
            await query(
              `UPDATE failed_classifications 
               SET error_message = $1, retry_count = retry_count + 1, failed_at = CURRENT_TIMESTAMP
               WHERE chunk_id = $2`,
              [errorMsg.substring(0, 1000), failedChunk.chunk_id]
            );
          }
        } else {
          console.error(`   ❌ Failed to retry chunk ${failedChunk.chunk_id}:`, errorMsg);
          await query(
            `UPDATE failed_classifications 
             SET error_message = $1, retry_count = retry_count + 1, failed_at = CURRENT_TIMESTAMP
             WHERE chunk_id = $2`,
            [errorMsg.substring(0, 1000), failedChunk.chunk_id]
          );
        }
      }
    }

    console.log(`✅ Retry batch complete! Retried ${retried}, still failed: ${stillFailed}`);

    // Get remaining count
    const remainingResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM failed_classifications');
    const remaining = parseInt(remainingResult.rows[0].count, 10);

    return NextResponse.json({
      status: 'success',
      retried,
      stillFailed,
      remaining,
      message: `Retried ${retried} chunks. ${remaining} still failed.`,
    });
  } catch (error) {
    console.error('❌ Failed to retry classifications:', error);
    return NextResponse.json(
      {
        error: 'Failed to retry classifications',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


import { NextResponse } from 'next/server';
import { query, ensureSubjectColumn } from '@/lib/database/client';
import { initializeDatabase } from '@/lib/database/client';
import { classifyChunkSubject } from '@/lib/subjectClassifier';

/**
 * POST /api/classify-chunks - Classify unclassified chunks by subject
 * This can be run after migration to classify all chunks
 */
export async function POST() {
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

    // Ensure schema is up to date (adds subject column if missing)
    try {
      await ensureSubjectColumn();
    } catch (schemaError) {
      console.error('Schema initialization error (non-critical):', schemaError);
      // Try full initialization as fallback
      try {
        await initializeDatabase();
      } catch (fallbackError) {
        console.error('Full initialization also failed:', fallbackError);
      }
    }

    console.log('🧠 Starting chunk classification...');

    // Reduce batch size to 5 to respect free tier rate limit (5 requests/minute)
    const BATCH_SIZE = 5;
    const DELAY_BETWEEN_REQUESTS_MS = 13000; // 13 seconds between requests (60s / 5 = 12s, add 1s buffer)

    // Get unclassified chunks (limit to batch size to respect rate limits)
    const unclassified = await query<{ id: number; text: string }>(
      `SELECT id, text FROM chunks WHERE subject IS NULL LIMIT ${BATCH_SIZE}`
    );

    if (unclassified.rows.length === 0) {
      return NextResponse.json({
        status: 'complete',
        message: 'All chunks are already classified',
        classified: 0,
      });
    }

    console.log(`📊 Found ${unclassified.rows.length} unclassified chunks (processing ${BATCH_SIZE} per batch to respect rate limits)`);

    let classified = 0;
    let errors = 0;

    for (let i = 0; i < unclassified.rows.length; i++) {
      const chunk = unclassified.rows[i];
      
      // Add delay between requests (except for the first one)
      if (i > 0) {
        console.log(`   ⏳ Waiting ${DELAY_BETWEEN_REQUESTS_MS / 1000}s to respect rate limits...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS_MS));
      }

      try {
        const subject = await classifyChunkSubject(chunk.text);
        await query('UPDATE chunks SET subject = $1 WHERE id = $2', [subject, chunk.id]);
        classified++;
        console.log(`   ✅ Classified chunk ${chunk.id} as "${subject}" (${classified}/${unclassified.rows.length})`);
      } catch (error: any) {
        errors++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        // Check if it's a rate limit error
        if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('rate limit')) {
          console.error(`   ⚠️ Rate limit hit for chunk ${chunk.id}, stopping batch. Please wait and try again.`);
          // Don't mark as 'other', leave it unclassified so it can be retried
          break; // Stop processing this batch
        } else {
          console.error(`   ❌ Failed to classify chunk ${chunk.id}:`, errorMsg);
          // For non-rate-limit errors, mark as 'other' to avoid retrying
          await query('UPDATE chunks SET subject = $1 WHERE id = $2', ['other', chunk.id]);
          classified++;
        }
      }
    }

    console.log(`✅ Classification batch complete! Classified ${classified} chunks, ${errors} errors`);

    // Calculate remaining
    const remainingResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM chunks WHERE subject IS NULL');
    const remaining = parseInt(remainingResult.rows[0].count, 10);

    return NextResponse.json({
      status: 'success',
      classified,
      remaining,
      batchSize: BATCH_SIZE,
      message: remaining > 0 
        ? `Classified ${classified} chunks. ${remaining} remaining. Run again to classify more (${BATCH_SIZE} per batch due to rate limits).`
        : `Classified ${classified} chunks. All chunks are now classified!`,
    });
  } catch (error) {
    console.error('❌ Classification failed:', error);
    return NextResponse.json(
      {
        error: 'Classification failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/classify-chunks - Clear all classifications (set subject to NULL)
 */
export async function DELETE() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set', status: 'not_configured' },
        { status: 400 }
      );
    }

    console.log('🗑️ Clearing all chunk classifications...');

    const result = await query<{ count: string }>('UPDATE chunks SET subject = NULL RETURNING id');
    const clearedCount = result.rowCount || 0;

    console.log(`✅ Cleared ${clearedCount} classifications`);

    return NextResponse.json({
      status: 'success',
      cleared: clearedCount,
      message: `Cleared ${clearedCount} chunk classifications.`,
    });
  } catch (error) {
    console.error('❌ Failed to clear classifications:', error);
    return NextResponse.json(
      {
        error: 'Failed to clear classifications',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/classify-chunks - Check classification status
 */
export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set', status: 'not_configured' },
        { status: 400 }
      );
    }

    // Ensure schema is up to date (adds subject column if missing)
    try {
      await ensureSubjectColumn();
    } catch (schemaError) {
      console.error('Schema initialization error (non-critical):', schemaError);
      // Try full initialization as fallback
      try {
        await initializeDatabase();
      } catch (fallbackError) {
        console.error('Full initialization also failed:', fallbackError);
      }
    }

    const total = await query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');
    const classified = await query<{ count: string }>('SELECT COUNT(*) as count FROM chunks WHERE subject IS NOT NULL');
    const unclassified = await query<{ count: string }>('SELECT COUNT(*) as count FROM chunks WHERE subject IS NULL');

    return NextResponse.json({
      status: 'ok',
      total: parseInt(total.rows[0].count, 10),
      classified: parseInt(classified.rows[0].count, 10),
      unclassified: parseInt(unclassified.rows[0].count, 10),
      percentage: total.rows[0].count === '0' 
        ? 0 
        : Math.round((parseInt(classified.rows[0].count, 10) / parseInt(total.rows[0].count, 10)) * 100),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to get classification status',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


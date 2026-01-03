import { NextResponse } from 'next/server';
import { query, ensureSubjectColumn, ensureFailedClassificationsTable } from '@/lib/database/client';
import { initializeDatabase } from '@/lib/database/client';
import { classifyChunkSubject } from '@/lib/subjectClassifier';

/**
 * Extract retry delay from Gemini API error message
 * Returns delay in milliseconds, or null if not found
 */
function extractRetryDelay(error: any): number | null {
  try {
    // First, try to find retryDelay in the error message string
    const errorStr = error?.message || error?.toString() || JSON.stringify(error);
    
    // Look for "Please retry in X.XXs" pattern
    const retryMatch = errorStr.match(/Please retry in ([\d.]+)s/i);
    if (retryMatch) {
      const seconds = parseFloat(retryMatch[1]);
      console.log(`   🔍 Extracted retry delay from message: ${seconds}s`);
      return Math.ceil(seconds * 1000) + 1000; // Convert to ms and add 1 second buffer
    }
    
    // Look for "retryDelay":"Xs" pattern in JSON
    const jsonMatch = errorStr.match(/"retryDelay"\s*:\s*"([\d.]+)s"/i);
    if (jsonMatch) {
      const seconds = parseFloat(jsonMatch[1]);
      console.log(`   🔍 Extracted retry delay from JSON: ${seconds}s`);
      return Math.ceil(seconds * 1000) + 1000;
    }
    
    // Check errorDetails array for RetryInfo
    if (error?.errorDetails && Array.isArray(error.errorDetails)) {
      const retryInfo = error.errorDetails.find((d: any) => 
        d['@type']?.includes('RetryInfo') || d['@type']?.includes('retry')
      );
      if (retryInfo?.retryDelay) {
        // retryDelay might be "31s" or a number
        const delayStr = String(retryInfo.retryDelay);
        const secondsMatch = delayStr.match(/([\d.]+)s?/);
        if (secondsMatch) {
          const seconds = parseFloat(secondsMatch[1]);
          console.log(`   🔍 Extracted retry delay from errorDetails: ${seconds}s`);
          return Math.ceil(seconds * 1000) + 1000;
        }
      }
    }
    
    // Check nested error structure (error.error might contain errorDetails)
    if (error?.error?.errorDetails && Array.isArray(error.error.errorDetails)) {
      const retryInfo = error.error.errorDetails.find((d: any) => 
        d['@type']?.includes('RetryInfo') || d['@type']?.includes('retry')
      );
      if (retryInfo?.retryDelay) {
        const delayStr = String(retryInfo.retryDelay);
        const secondsMatch = delayStr.match(/([\d.]+)s?/);
        if (secondsMatch) {
          const seconds = parseFloat(secondsMatch[1]);
          console.log(`   🔍 Extracted retry delay from nested error: ${seconds}s`);
          return Math.ceil(seconds * 1000) + 1000;
        }
      }
    }
    
    // Last resort: search the entire error object as JSON string
    try {
      const fullErrorStr = JSON.stringify(error);
      const fullJsonMatch = fullErrorStr.match(/"retryDelay"\s*:\s*"([\d.]+)s"/i);
      if (fullJsonMatch) {
        const seconds = parseFloat(fullJsonMatch[1]);
        console.log(`   🔍 Extracted retry delay from full JSON: ${seconds}s`);
        return Math.ceil(seconds * 1000) + 1000;
      }
    } catch (e) {
      // Ignore JSON stringify errors
    }
    
    console.log(`   ⚠️ Could not extract retry delay from error. Error structure:`, {
      hasErrorDetails: !!error?.errorDetails,
      hasError: !!error?.error,
      message: error?.message?.substring(0, 200),
    });
  } catch (e) {
    console.error(`   ❌ Error extracting retry delay:`, e);
  }
  return null;
}

/**
 * Store failed classification in database
 */
async function storeFailedClassification(chunkId: number, errorMessage: string): Promise<void> {
  try {
    await query(
      `INSERT INTO failed_classifications (chunk_id, error_message, retry_count)
       VALUES ($1, $2, 0)
       ON CONFLICT (chunk_id) 
       DO UPDATE SET error_message = EXCLUDED.error_message, retry_count = failed_classifications.retry_count + 1, failed_at = CURRENT_TIMESTAMP`,
      [chunkId, errorMessage.substring(0, 1000)] // Limit error message length
    );
  } catch (err) {
    console.error(`Failed to store failed classification for chunk ${chunkId}:`, err);
  }
}

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

    // Ensure schema is up to date (adds subject column and failed_classifications table if missing)
    try {
      await ensureSubjectColumn();
      await ensureFailedClassificationsTable();
    } catch (schemaError) {
      console.error('Schema initialization error (non-critical):', schemaError);
      // Try full initialization as fallback
      try {
        await initializeDatabase();
        await ensureFailedClassificationsTable();
      } catch (fallbackError) {
        console.error('Full initialization also failed:', fallbackError);
      }
    }

    console.log('🧠 Starting chunk classification...');

    // Batch size and delay for gemini-2.5-flash-lite: 15 requests/minute, 1000/day
    const BATCH_SIZE = 15; // Process 15 chunks per batch (matches per-minute limit)
    const DELAY_BETWEEN_REQUESTS_MS = 5000; // 5 seconds between requests (60s / 15 = 4s, add 1s buffer)

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
        
        // Remove from failed_classifications if it was there
        await query('DELETE FROM failed_classifications WHERE chunk_id = $1', [chunk.id]);
        
        classified++;
        console.log(`   ✅ Classified chunk ${chunk.id} as "${subject}" (${classified}/${unclassified.rows.length})`);
      } catch (error: any) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        // Check if it's a rate limit error
        const isRateLimit = errorMsg.includes('429') || 
                           errorMsg.includes('quota') || 
                           errorMsg.includes('rate limit') ||
                           errorMsg.includes('Too Many Requests');
        
        if (isRateLimit) {
          // Log the full error structure for debugging
          console.log(`   🔍 Rate limit error detected for chunk ${chunk.id}. Error structure:`, {
            message: errorMsg?.substring(0, 300),
            hasErrorDetails: !!error?.errorDetails,
            hasError: !!error?.error,
            status: error?.status,
            statusText: error?.statusText,
          });
          
          // Extract retry delay from error
          const retryDelay = extractRetryDelay(error);
          
          if (retryDelay !== null) {
            console.log(`   ⏳ Rate limit hit for chunk ${chunk.id}. Retrying after ${retryDelay / 1000}s (extracted from API error)...`);
            try {
              // Wait for retry delay (already includes 1 second buffer)
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              
              // Retry classification
              const subject = await classifyChunkSubject(chunk.text);
              await query('UPDATE chunks SET subject = $1 WHERE id = $2', [subject, chunk.id]);
              
              // Remove from failed_classifications if it was there
              await query('DELETE FROM failed_classifications WHERE chunk_id = $1', [chunk.id]);
              
              classified++;
              console.log(`   ✅ Classified chunk ${chunk.id} as "${subject}" after retry (${classified}/${unclassified.rows.length})`);
              // Don't increment errors - retry succeeded!
            } catch (retryError: any) {
              // Retry also failed, count as error and store in failed_classifications
              errors++;
              const retryErrorMsg = retryError instanceof Error ? retryError.message : String(retryError);
              console.error(`   ❌ Retry failed for chunk ${chunk.id}, storing in failed classifications:`, retryErrorMsg);
              await storeFailedClassification(chunk.id, `Rate limit retry failed: ${retryErrorMsg}`);
            }
          } else {
            // Can't extract delay, use default delay and retry once
            const defaultDelay = 5000; // 5 seconds default
            console.log(`   ⚠️ Rate limit hit for chunk ${chunk.id} but couldn't extract retry delay. Using default ${defaultDelay / 1000}s delay...`);
            try {
              await new Promise(resolve => setTimeout(resolve, defaultDelay));
              
              // Retry classification
              const subject = await classifyChunkSubject(chunk.text);
              await query('UPDATE chunks SET subject = $1 WHERE id = $2', [subject, chunk.id]);
              
              // Remove from failed_classifications if it was there
              await query('DELETE FROM failed_classifications WHERE chunk_id = $1', [chunk.id]);
              
              classified++;
              console.log(`   ✅ Classified chunk ${chunk.id} as "${subject}" after default delay retry (${classified}/${unclassified.rows.length})`);
            } catch (retryError: any) {
              // Retry failed, count as error and store as failed
              errors++;
              const retryErrorMsg = retryError instanceof Error ? retryError.message : String(retryError);
              console.error(`   ❌ Default delay retry also failed for chunk ${chunk.id}, storing as failed:`, retryErrorMsg);
              await storeFailedClassification(chunk.id, `Rate limit (no delay extracted): ${errorMsg}`);
            }
          }
        } else {
          // Non-rate-limit error, count as error and store as failed
          errors++;
          console.error(`   ❌ Failed to classify chunk ${chunk.id}:`, errorMsg);
          await storeFailedClassification(chunk.id, errorMsg);
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
  const startTime = Date.now();
  
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set', status: 'not_configured' },
        { status: 400 }
      );
    }

    console.log('🗑️ Starting to clear all chunk classifications...');
    const logStart = Date.now();

    // First, count how many chunks are classified (for logging)
    console.log('   📊 Counting classified chunks...');
    const countStart = Date.now();
    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM chunks WHERE subject IS NOT NULL'
    );
    const classifiedCount = parseInt(countResult.rows[0].count, 10);
    const countDuration = Date.now() - countStart;
    console.log(`   ✅ Found ${classifiedCount} classified chunks (took ${countDuration}ms)`);

    if (classifiedCount === 0) {
      console.log('   ℹ️ No chunks to clear');
      return NextResponse.json({
        status: 'success',
        cleared: 0,
        message: 'No chunks were classified. Nothing to clear.',
      });
    }

    // Now clear all classifications (UPDATE without RETURNING is faster)
    console.log(`   🔄 Clearing ${classifiedCount} classifications...`);
    const updateStart = Date.now();
    const result = await query('UPDATE chunks SET subject = NULL');
    const updateDuration = Date.now() - updateStart;
    const clearedCount = result.rowCount || 0;

    const totalDuration = Date.now() - startTime;
    console.log(`✅ Cleared ${clearedCount} classifications in ${totalDuration}ms (count: ${countDuration}ms, update: ${updateDuration}ms)`);

    return NextResponse.json({
      status: 'success',
      cleared: clearedCount,
      message: `Cleared ${clearedCount} chunk classifications.`,
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`❌ Failed to clear classifications after ${totalDuration}ms:`, error);
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

    // Ensure schema is up to date (adds subject column and failed_classifications table if missing)
    try {
      await ensureSubjectColumn();
      await ensureFailedClassificationsTable();
    } catch (schemaError) {
      console.error('Schema initialization error (non-critical):', schemaError);
      // Try full initialization as fallback
      try {
        await initializeDatabase();
        await ensureFailedClassificationsTable();
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


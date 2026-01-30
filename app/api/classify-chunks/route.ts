import { NextResponse } from 'next/server';
import { query, ensureSubjectColumn, ensureFailedClassificationsTable } from '@/lib/database/client';
import { initializeDatabase } from '@/lib/database/client';
import { classifyChunkSubject } from '@/lib/subjectClassifier';

// In-memory state for classification process
let classificationState: {
  isRunning: boolean;
  abortController: AbortController | null;
  lastProcessedId: number;
} = {
  isRunning: false,
  abortController: null,
  lastProcessedId: 0,
};

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
      [chunkId, errorMessage.substring(0, 1000)]
    );
  } catch (err) {
    console.error(`Failed to store failed classification for chunk ${chunkId}:`, err);
  }
}

/**
 * GET /api/classify-chunks/status - Get classification status
 */
export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set', status: 'not_configured' },
        { status: 400 }
      );
    }

    // Ensure schema is up to date
    try {
      await ensureSubjectColumn();
      await ensureFailedClassificationsTable();
    } catch (schemaError) {
      console.error('Schema initialization error (non-critical):', schemaError);
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
      isRunning: classificationState.isRunning,
      lastProcessedId: classificationState.lastProcessedId,
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

/**
 * POST /api/classify-chunks - Start/resume classification
 * Query params: ?reclassifyOther=true to reclassify only chunks with subject='other'
 */
export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set', status: 'not_configured' },
        { status: 400 }
      );
    }

    if (classificationState.isRunning) {
      return NextResponse.json(
        { error: 'Classification is already running', status: 'already_running' },
        { status: 409 }
      );
    }

    // Check if we should reclassify only "other" chunks
    const url = new URL(request.url);
    const reclassifyOther = url.searchParams.get('reclassifyOther') === 'true';

    // Ensure schema is up to date
    try {
      await ensureSubjectColumn();
      await ensureFailedClassificationsTable();
    } catch (schemaError) {
      console.error('Schema initialization error (non-critical):', schemaError);
      try {
        await initializeDatabase();
        await ensureFailedClassificationsTable();
      } catch (fallbackError) {
        console.error('Full initialization also failed:', fallbackError);
      }
    }

    // Start classification process (async, don't await)
    const startClassification = async () => {
      classificationState.isRunning = true;
      classificationState.abortController = new AbortController();
      const signal = classificationState.abortController.signal;

      const PARALLEL_SIZE = 3; // Process 3 chunks in parallel
      const DELAY_BETWEEN_BATCHES_MS = 2000; // 2 seconds between batches

      try {
        let classified = 0;
        let errors = 0;
        let lastProcessedId = classificationState.lastProcessedId || 0;

        console.log('\u001b[36mStarting chunk classification...\u001b[0m');
        console.log(`\u001b[36mStarting from chunk ID: ${lastProcessedId + 1}\u001b[0m`);

        while (!signal.aborted) {
          // Get next chunks to classify - either unclassified or "other" chunks (if reclassifyOther)
          const unclassified = await query<{ id: number; text: string }>(
            reclassifyOther
              ? `SELECT id, text 
                 FROM chunks 
                 WHERE subject = 'other' AND id > $1 
                 ORDER BY id ASC 
                 LIMIT ${PARALLEL_SIZE}`
              : `SELECT id, text 
                 FROM chunks 
                 WHERE subject IS NULL AND id > $1 
                 ORDER BY id ASC 
                 LIMIT ${PARALLEL_SIZE}`,
            [lastProcessedId]
          );

          if (unclassified.rows.length === 0) {
            console.log('\u001b[32mAll chunks classified!\u001b[0m');
            break;
          }

          // Process chunks in parallel
          const promises = unclassified.rows.map(async (chunk) => {
            try {
              const subject = await classifyChunkSubject(chunk.text, signal);
              
              if (signal.aborted) {
                throw new Error('Classification cancelled');
              }

              // Return classification result for batch update (optimized)
              return { success: true, chunkId: chunk.id, subject };
            } catch (error: any) {
              if (signal.aborted) {
                console.log(`\u001b[33mClassification cancelled for chunk ${chunk.id}\u001b[0m`);
                throw error;
              }

              const errorMsg = error instanceof Error ? error.message : String(error);
              console.error(`\u001b[31mFailed to classify chunk ${chunk.id}: ${errorMsg}\u001b[0m`);
              
              errors++;
              await storeFailedClassification(chunk.id, errorMsg);
              
              return { success: false, chunkId: chunk.id, error: errorMsg };
            }
          });

          const results = await Promise.all(promises);
          
          // Batch update successful classifications (optimized - batch operations)
          const successful = results.filter(r => r.success && 'subject' in r) as Array<{ chunkId: number; subject: string }>;
          if (successful.length > 0) {
            const updateIds = successful.map(r => r.chunkId);
            
            // Batch UPDATE using VALUES clause with JOIN (more efficient than individual queries)
            // Build VALUES clause: (id1, subject1), (id2, subject2), ...
            const values = successful.map((r, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
            const params = successful.flatMap(r => [r.chunkId, r.subject]);
            
            await query(
              `UPDATE chunks c
               SET subject = v.subject
               FROM (VALUES ${values}) AS v(id, subject)
               WHERE c.id = v.id`,
              params
            );
            
            // Batch DELETE failed_classifications (optimized)
            await query(
              'DELETE FROM failed_classifications WHERE chunk_id = ANY($1::int[])',
              [updateIds]
            );
            
            // Update last processed ID
            const maxId = Math.max(...updateIds);
            lastProcessedId = Math.max(lastProcessedId, maxId);
            classificationState.lastProcessedId = lastProcessedId;
            
            classified += successful.length;
            successful.forEach(r => {
              console.log(`\u001b[32mClassified chunk ${r.chunkId} as "${r.subject}"\u001b[0m`);
            });
          }
          
          // Check if any succeeded (if all failed and aborted, break)
          const successCount = results.filter(r => r.success).length;
          if (successCount === 0 && signal.aborted) {
            break;
          }

          // Wait before next batch (unless aborted)
          if (!signal.aborted && unclassified.rows.length === PARALLEL_SIZE) {
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
          }
        }

        const remaining = await query<{ count: string }>('SELECT COUNT(*) as count FROM chunks WHERE subject IS NULL');
        const remainingCount = parseInt(remaining.rows[0].count, 10);

        console.log(`\u001b[32mClassification complete! Classified: ${classified}, Errors: ${errors}, Remaining: ${remainingCount}\u001b[0m`);
      } catch (error) {
        if (!signal.aborted) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`\u001b[31mClassification error: ${errorMsg}\u001b[0m`);
        }
      } finally {
        classificationState.isRunning = false;
        classificationState.abortController = null;
      }
    };

    // Start async process
    startClassification().catch(err => {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`\u001b[31mClassification process error: ${errorMsg}\u001b[0m`);
      classificationState.isRunning = false;
      classificationState.abortController = null;
    });

    // Return immediately
    return NextResponse.json({
      status: 'started',
      message: 'Classification started',
    });
  } catch (error) {
    classificationState.isRunning = false;
    classificationState.abortController = null;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\u001b[31mFailed to start classification: ${errorMsg}\u001b[0m`);
    return NextResponse.json(
      {
        error: 'Failed to start classification',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/classify-chunks - Stop classification or clear all classifications
 * If ?action=stop, stops the running classification
 * Otherwise, clears all classifications
 */
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'stop') {
    // Stop running classification
    if (classificationState.isRunning && classificationState.abortController) {
      classificationState.abortController.abort();
      console.log('\u001b[33mClassification stopped by user\u001b[0m');
      
      // Wait a bit for cancellation to propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return NextResponse.json({
        status: 'stopped',
        message: 'Classification stopped',
        lastProcessedId: classificationState.lastProcessedId,
      });
    } else {
      return NextResponse.json(
        { error: 'No classification is currently running', status: 'not_running' },
        { status: 409 }
      );
    }
  }

  // Clear all classifications
  const startTime = Date.now();
  
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set', status: 'not_configured' },
        { status: 400 }
      );
    }

    console.log('\u001b[36mStarting to clear all chunk classifications...\u001b[0m');

    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM chunks WHERE subject IS NOT NULL'
    );
    const classifiedCount = parseInt(countResult.rows[0].count, 10);

    if (classifiedCount === 0) {
      return NextResponse.json({
        status: 'success',
        cleared: 0,
        message: 'No chunks were classified. Nothing to clear.',
      });
    }

    const result = await query('UPDATE chunks SET subject = NULL');
    const clearedCount = result.rowCount || 0;
    
    // Reset last processed ID
    classificationState.lastProcessedId = 0;

    const totalDuration = Date.now() - startTime;
    console.log(`\u001b[32mCleared ${clearedCount} classifications in ${totalDuration}ms\u001b[0m`);

    return NextResponse.json({
      status: 'success',
      cleared: clearedCount,
      message: `Cleared ${clearedCount} chunk classifications.`,
    });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\u001b[31mFailed to clear classifications after ${totalDuration}ms: ${errorMsg}\u001b[0m`);
    return NextResponse.json(
      {
        error: 'Failed to clear classifications',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

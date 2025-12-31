import { NextResponse } from 'next/server';
import { query } from '@/lib/database/client';
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
      await initializeDatabase();
    } catch (schemaError) {
      console.error('Schema initialization error (non-critical):', schemaError);
    }

    console.log('🧠 Starting chunk classification...');

    // Get all unclassified chunks
    const unclassified = await query<{ id: number; text: string }>(
      'SELECT id, text FROM chunks WHERE subject IS NULL LIMIT 100'
    );

    if (unclassified.rows.length === 0) {
      return NextResponse.json({
        status: 'complete',
        message: 'All chunks are already classified',
        classified: 0,
      });
    }

    console.log(`📊 Found ${unclassified.rows.length} unclassified chunks`);

    let classified = 0;
    for (const chunk of unclassified.rows) {
      try {
        const subject = await classifyChunkSubject(chunk.text);
        await query('UPDATE chunks SET subject = $1 WHERE id = $2', [subject, chunk.id]);
        classified++;
        
        if (classified % 10 === 0) {
          console.log(`   📊 Classified ${classified}/${unclassified.rows.length} chunks...`);
        }
      } catch (error) {
        console.error(`   ❌ Failed to classify chunk ${chunk.id}:`, error);
        // Mark as 'other' to avoid retrying
        await query('UPDATE chunks SET subject = $1 WHERE id = $2', ['other', chunk.id]);
        classified++;
      }
    }

    console.log(`✅ Classification complete! Classified ${classified} chunks`);

    return NextResponse.json({
      status: 'success',
      classified,
      remaining: unclassified.rows.length - classified,
      message: `Classified ${classified} chunks. Run again to classify more.`,
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
      await initializeDatabase();
    } catch (schemaError) {
      console.error('Schema initialization error (non-critical):', schemaError);
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


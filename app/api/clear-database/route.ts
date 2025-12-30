import { NextResponse } from 'next/server';
import { query } from '@/lib/database/client';

/**
 * API endpoint to clear the database
 * POST /api/clear-database - Delete all documents and chunks
 */
export async function POST() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set' },
        { status: 400 }
      );
    }

    console.log('🗑️ Clearing database...');
    
    // Get counts before clearing
    const docsBefore = await query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
    const chunksBefore = await query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');
    
    // Clear all data
    await query('DELETE FROM chunks');
    await query('DELETE FROM documents');
    
    console.log(`✅ Cleared ${docsBefore.rows[0].count} documents and ${chunksBefore.rows[0].count} chunks`);

    return NextResponse.json({
      status: 'success',
      cleared: {
        documents: parseInt(docsBefore.rows[0].count, 10),
        chunks: parseInt(chunksBefore.rows[0].count, 10),
      },
      message: `Cleared ${docsBefore.rows[0].count} documents and ${chunksBefore.rows[0].count} chunks`,
    });

  } catch (error) {
    console.error('❌ Clear database failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to clear database',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/clear-database - Show current counts (confirmation before clearing)
 */
export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set' },
        { status: 400 }
      );
    }

    const docs = await query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
    const chunks = await query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');

    return NextResponse.json({
      documents: parseInt(docs.rows[0].count, 10),
      chunks: parseInt(chunks.rows[0].count, 10),
      message: 'Use POST to clear all data',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get counts' },
      { status: 500 }
    );
  }
}


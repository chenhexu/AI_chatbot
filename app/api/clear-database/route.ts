import { NextResponse } from 'next/server';
import { query } from '@/lib/database/client';

/**
 * POST /api/clear-database - Delete all documents and chunks
 */
export async function POST() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set', status: 'not_configured' },
        { status: 400 }
      );
    }

    console.log('🗑️ Clearing database...');

    // Delete all chunks first (foreign key constraint)
    const chunksResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');
    const chunksDeleted = parseInt(chunksResult.rows[0].count, 10);
    await query('DELETE FROM chunks');

    // Delete all documents
    const docsResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
    const docsDeleted = parseInt(docsResult.rows[0].count, 10);
    await query('DELETE FROM documents');

    console.log(`✅ Deleted ${docsDeleted} documents and ${chunksDeleted} chunks`);

    return NextResponse.json({
      status: 'success',
      documentsDeleted: docsDeleted,
      chunksDeleted: chunksDeleted,
      message: `Deleted ${docsDeleted} documents and ${chunksDeleted} chunks`,
    });
  } catch (error) {
    console.error('❌ Failed to clear database:', error);
    return NextResponse.json(
      {
        error: 'Failed to clear database',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}


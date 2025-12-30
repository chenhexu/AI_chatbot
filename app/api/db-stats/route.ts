import { NextResponse } from 'next/server';
import { query } from '@/lib/database/client';

/**
 * GET /api/db-stats - Get database statistics including biggest chunks
 */
export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set', status: 'not_configured' },
        { status: 400 }
      );
    }

    // Get total counts
    const docCount = await query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
    const chunkCount = await query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');

    // Get biggest 5 chunks by content length
    const biggestChunks = await query<{
      id: number;
      document_id: number;
      chunk_index: number;
      content_length: number;
      content_preview: string;
      source_id: string;
    }>(`
      SELECT 
        c.id,
        c.document_id,
        c.chunk_index,
        LENGTH(c.content) as content_length,
        LEFT(c.content, 200) as content_preview,
        d.source_id
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      ORDER BY LENGTH(c.content) DESC
      LIMIT 5
    `);

    // Get chunk size distribution
    const sizeDistribution = await query<{ size_range: string; count: string }>(`
      SELECT 
        CASE 
          WHEN LENGTH(content) < 1000 THEN '< 1KB'
          WHEN LENGTH(content) < 5000 THEN '1-5KB'
          WHEN LENGTH(content) < 10000 THEN '5-10KB'
          WHEN LENGTH(content) < 100000 THEN '10-100KB'
          WHEN LENGTH(content) < 1000000 THEN '100KB-1MB'
          ELSE '> 1MB'
        END as size_range,
        COUNT(*) as count
      FROM chunks
      GROUP BY size_range
      ORDER BY 
        CASE size_range
          WHEN '< 1KB' THEN 1
          WHEN '1-5KB' THEN 2
          WHEN '5-10KB' THEN 3
          WHEN '10-100KB' THEN 4
          WHEN '100KB-1MB' THEN 5
          ELSE 6
        END
    `);

    // Get average chunk size
    const avgSize = await query<{ avg_size: string }>(`
      SELECT ROUND(AVG(LENGTH(content))) as avg_size FROM chunks
    `);

    return NextResponse.json({
      status: 'ok',
      documents: parseInt(docCount.rows[0].count, 10),
      chunks: parseInt(chunkCount.rows[0].count, 10),
      averageChunkSize: parseInt(avgSize.rows[0]?.avg_size || '0', 10),
      sizeDistribution: sizeDistribution.rows.map(r => ({
        range: r.size_range,
        count: parseInt(r.count, 10),
      })),
      biggestChunks: biggestChunks.rows.map(c => ({
        id: c.id,
        documentId: c.document_id,
        chunkIndex: c.chunk_index,
        size: c.content_length,
        sizeFormatted: formatBytes(c.content_length),
        sourceId: c.source_id,
        preview: c.content_preview + (c.content_length > 200 ? '...' : ''),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to get stats',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}


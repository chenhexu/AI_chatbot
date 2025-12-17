import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database/client';
import * as crypto from 'crypto';

/**
 * API endpoint to deduplicate documents in the database
 * POST /api/deduplicate - Remove duplicate documents, keeping only one copy
 */
export async function POST(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set', status: 'not_configured' },
        { status: 400 }
      );
    }

    console.log('🔍 Starting deduplication...');

    // Find duplicates by source_id (should be unique)
    const duplicatesResult = await query<{ source_id: string; count: string; ids: string }>(
      `SELECT source_id, COUNT(*) as count, array_agg(id::text) as ids
       FROM documents
       GROUP BY source_id
       HAVING COUNT(*) > 1`
    );

    if (duplicatesResult.rows.length === 0) {
      return NextResponse.json({
        status: 'no_duplicates',
        message: 'No duplicate documents found',
        removed: 0,
      });
    }

    let totalRemoved = 0;
    const duplicateGroups = duplicatesResult.rows;

    for (const group of duplicateGroups) {
      const ids = group.ids.split(',').map(id => parseInt(id.trim(), 10));
      // Keep the first one (oldest), remove the rest
      const idsToRemove = ids.slice(1);

      console.log(`📋 Found ${ids.length} copies of ${group.source_id}, removing ${idsToRemove.length}...`);

      // Delete chunks for documents we're removing
      for (const docId of idsToRemove) {
        await query('DELETE FROM chunks WHERE document_id = $1', [docId]);
        await query('DELETE FROM documents WHERE id = $1', [docId]);
        totalRemoved++;
      }
    }

    // Also check for duplicates by content hash (in case source_id differs but content is same)
    console.log('🔍 Checking for content duplicates...');
    const allDocs = await query<{ id: number; source_id: string; content: string }>(
      'SELECT id, source_id, content FROM documents ORDER BY id'
    );

    const contentHashes = new Map<string, number[]>();
    for (const doc of allDocs.rows) {
      const hash = crypto.createHash('md5').update(doc.content).digest('hex');
      if (!contentHashes.has(hash)) {
        contentHashes.set(hash, []);
      }
      contentHashes.get(hash)!.push(doc.id);
    }

    let contentDuplicatesRemoved = 0;
    for (const [hash, ids] of contentHashes.entries()) {
      if (ids.length > 1) {
        // Keep the first one, remove the rest
        const idsToRemove = ids.slice(1);
        console.log(`📋 Found ${ids.length} documents with same content (hash: ${hash.substring(0, 8)}...), removing ${idsToRemove.length}...`);

        for (const docId of idsToRemove) {
          await query('DELETE FROM chunks WHERE document_id = $1', [docId]);
          await query('DELETE FROM documents WHERE id = $1', [docId]);
          contentDuplicatesRemoved++;
          totalRemoved++;
        }
      }
    }

    // Get final counts
    const finalDocCount = await query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
    const finalChunkCount = await query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');

    console.log(`✅ Deduplication complete! Removed ${totalRemoved} duplicate documents`);

    return NextResponse.json({
      status: 'success',
      removed: totalRemoved,
      sourceIdDuplicates: duplicateGroups.length,
      contentDuplicates: contentDuplicatesRemoved,
      remaining: {
        documents: parseInt(finalDocCount.rows[0].count, 10),
        chunks: parseInt(finalChunkCount.rows[0].count, 10),
      },
      message: `Removed ${totalRemoved} duplicate document(s). ${finalDocCount.rows[0].count} unique documents remain.`,
    });

  } catch (error) {
    console.error('❌ Deduplication failed:', error);
    return NextResponse.json(
      {
        error: 'Deduplication failed',
        details: error instanceof Error ? error.message : String(error),
        status: 'error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/deduplicate - Check for duplicates
 */
export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set', status: 'not_configured' },
        { status: 400 }
      );
    }

    // Check for duplicates by source_id
    const duplicatesResult = await query<{ source_id: string; count: string }>(
      `SELECT source_id, COUNT(*) as count
       FROM documents
       GROUP BY source_id
       HAVING COUNT(*) > 1`
    );

    // Check for duplicates by content hash
    const allDocs = await query<{ id: number; content: string }>(
      'SELECT id, content FROM documents'
    );

    const contentHashes = new Map<string, number[]>();
    for (const doc of allDocs.rows) {
      const hash = crypto.createHash('md5').update(doc.content).digest('hex');
      if (!contentHashes.has(hash)) {
        contentHashes.set(hash, []);
      }
      contentHashes.get(hash)!.push(doc.id);
    }

    const contentDuplicates = Array.from(contentHashes.entries())
      .filter(([_, ids]) => ids.length > 1)
      .map(([hash, ids]) => ({ hash: hash.substring(0, 8), count: ids.length }));

    const totalDuplicateDocs = duplicatesResult.rows.reduce((sum, row) => sum + parseInt(row.count, 10) - 1, 0) +
      contentDuplicates.reduce((sum, dup) => sum + dup.count - 1, 0);

    return NextResponse.json({
      status: 'ok',
      sourceIdDuplicates: duplicatesResult.rows.length,
      contentDuplicates: contentDuplicates.length,
      totalDuplicateDocuments: totalDuplicateDocs,
      message: totalDuplicateDocs > 0
        ? `Found ${totalDuplicateDocs} duplicate document(s)`
        : 'No duplicates found',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to check for duplicates',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}


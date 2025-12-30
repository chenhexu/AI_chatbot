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

    let totalRemoved = 0;

    // First, find duplicates by source_id (shouldn't exist due to UNIQUE constraint, but check anyway)
    const sourceIdDuplicates = await query<{ source_id: string; count: string; ids: string }>(
      `SELECT source_id, COUNT(*) as count, array_agg(id::text) as ids
       FROM documents
       GROUP BY source_id
       HAVING COUNT(*) > 1`
    );

    for (const group of sourceIdDuplicates.rows) {
      const ids = group.ids.replace(/[{}]/g, '').split(',').map(id => parseInt(id.trim(), 10));
      const idsToRemove = ids.slice(1);
      console.log(`📋 Found ${ids.length} copies of ${group.source_id}, removing ${idsToRemove.length}...`);

      for (const docId of idsToRemove) {
        await query('DELETE FROM chunks WHERE document_id = $1', [docId]);
        await query('DELETE FROM documents WHERE id = $1', [docId]);
        totalRemoved++;
      }
    }

    // Then check for content duplicates (same content, different source_id)
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
      status: totalRemoved > 0 ? 'success' : 'no_duplicates',
      removed: totalRemoved,
      sourceIdDuplicates: sourceIdDuplicates.rows.length,
      contentDuplicates: contentDuplicatesRemoved,
      remaining: {
        documents: parseInt(finalDocCount.rows[0].count, 10),
        chunks: parseInt(finalChunkCount.rows[0].count, 10),
      },
      message: totalRemoved > 0
        ? `Removed ${totalRemoved} duplicate document(s). ${finalDocCount.rows[0].count} unique documents remain.`
        : 'No duplicate documents found.',
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

    // Get all documents with their content
    const allDocs = await query<{ id: number; source_id: string; content: string }>(
      'SELECT id, source_id, content FROM documents ORDER BY id'
    );

    // Track which document IDs are duplicates
    const duplicateIds = new Set<number>();

    // Check for source_id duplicates (shouldn't exist due to UNIQUE, but check anyway)
    const sourceIdGroups = new Map<string, number[]>();
    for (const doc of allDocs.rows) {
      if (!sourceIdGroups.has(doc.source_id)) {
        sourceIdGroups.set(doc.source_id, []);
      }
      sourceIdGroups.get(doc.source_id)!.push(doc.id);
    }

    let sourceIdDuplicateGroups = 0;
    for (const [_, ids] of sourceIdGroups) {
      if (ids.length > 1) {
        sourceIdDuplicateGroups++;
        ids.slice(1).forEach(id => duplicateIds.add(id));
      }
    }

    // Check for content hash duplicates
    const contentHashes = new Map<string, number[]>();
    for (const doc of allDocs.rows) {
      // Skip if already marked as duplicate
      if (duplicateIds.has(doc.id)) continue;
      
      const hash = crypto.createHash('md5').update(doc.content).digest('hex');
      if (!contentHashes.has(hash)) {
        contentHashes.set(hash, []);
      }
      contentHashes.get(hash)!.push(doc.id);
    }

    let contentDuplicateGroups = 0;
    for (const [_, ids] of contentHashes) {
      if (ids.length > 1) {
        contentDuplicateGroups++;
        ids.slice(1).forEach(id => duplicateIds.add(id));
      }
    }

    return NextResponse.json({
      status: 'ok',
      sourceIdDuplicates: sourceIdDuplicateGroups,
      contentDuplicates: contentDuplicateGroups,
      totalDuplicateDocuments: duplicateIds.size,
      message: duplicateIds.size > 0
        ? `Found ${duplicateIds.size} duplicate document(s) to remove`
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

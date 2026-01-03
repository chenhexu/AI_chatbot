import { NextResponse } from 'next/server';
import { query } from '@/lib/database/client';
import { loadAllChunks } from '@/lib/database/documentStore';

/**
 * Health check endpoint with database diagnostics
 */
export async function GET() {
  const diagnostics: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      url_set: !!process.env.DATABASE_URL,
      connected: false,
      chunks_count: 0,
      documents_count: 0,
      error: null as string | null,
    },
  };

  // Check database if DATABASE_URL is set
  if (process.env.DATABASE_URL) {
    try {
      // Test connection
      await query('SELECT 1');
      diagnostics.database.connected = true;

      // Get counts
      try {
        const chunkCount = await query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');
        const docCount = await query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
        diagnostics.database.chunks_count = parseInt(chunkCount.rows[0].count, 10);
        diagnostics.database.documents_count = parseInt(docCount.rows[0].count, 10);

        // Try loading chunks
        const chunks = await loadAllChunks();
        diagnostics.database.chunks_loaded = chunks.length;
      } catch (countError) {
        diagnostics.database.error = countError instanceof Error ? countError.message : String(countError);
      }
    } catch (dbError) {
      diagnostics.database.connected = false;
      diagnostics.database.error = dbError instanceof Error ? dbError.message : String(dbError);
      diagnostics.status = 'degraded';
    }
  } else {
    diagnostics.status = 'warning';
    diagnostics.database.error = 'DATABASE_URL not set';
  }

  return NextResponse.json(diagnostics);
}




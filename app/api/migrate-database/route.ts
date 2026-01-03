import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

/**
 * API endpoint to migrate data from Render to Azure PostgreSQL
 * 
 * Requires both RENDER_DATABASE_URL and AZURE_DATABASE_URL environment variables
 * 
 * POST /api/migrate-database
 * Body: { renderUrl?: string, azureUrl?: string } (optional, uses env vars if not provided)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const renderUrl = body.renderUrl || process.env.RENDER_DATABASE_URL;
    const azureUrl = body.azureUrl || process.env.AZURE_DATABASE_URL;

    if (!renderUrl) {
      return NextResponse.json(
        { error: 'RENDER_DATABASE_URL not set' },
        { status: 400 }
      );
    }

    if (!azureUrl) {
      return NextResponse.json(
        { error: 'AZURE_DATABASE_URL not set' },
        { status: 400 }
      );
    }

    console.log('🚀 Starting database migration from Render to Azure...');

    // Render may not require SSL, but Azure PostgreSQL requires SSL
    const renderPool = new Pool({ 
      connectionString: renderUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    const azurePool = new Pool({ 
      connectionString: azureUrl,
      ssl: { rejectUnauthorized: false }, // Azure PostgreSQL requires SSL
    });

    try {
      // Test connections
      console.log('🔌 Testing Render database connection...');
      await renderPool.query('SELECT 1');
      console.log('✅ Connected to Render database');
      
      console.log('🔌 Testing Azure database connection...');
      await azurePool.query('SELECT 1');
      console.log('✅ Connected to Azure database');

      // Initialize Azure schema
      const fs = await import('fs');
      const path = await import('path');
      const schemaPath = path.join(process.cwd(), 'lib', 'database', 'schema.sql');
      const schema = await fs.promises.readFile(schemaPath, 'utf-8');
      await azurePool.query(schema);

      // Get counts from Render
      const renderDocCount = await renderPool.query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
      const renderChunkCount = await renderPool.query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');

      // Migrate documents
      const documents = await renderPool.query<{
        id: number;
        source_id: string;
        source_type: string;
        name: string | null;
        content: string;
        pdf_url: string | null;
        created_at: Date;
        updated_at: Date;
      }>('SELECT * FROM documents ORDER BY id');

      const documentIdMap = new Map<number, number>();
      let migratedDocs = 0;
      let skippedDocs = 0;

      for (const doc of documents.rows) {
        const existing = await azurePool.query<{ id: number }>(
          'SELECT id FROM documents WHERE source_id = $1',
          [doc.source_id]
        );

        if (existing.rows.length > 0) {
          documentIdMap.set(doc.id, existing.rows[0].id);
          skippedDocs++;
          continue;
        }

        const result = await azurePool.query<{ id: number }>(
          `INSERT INTO documents (source_id, source_type, name, content, pdf_url, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [doc.source_id, doc.source_type, doc.name, doc.content, doc.pdf_url, doc.created_at, doc.updated_at]
        );

        documentIdMap.set(doc.id, result.rows[0].id);
        migratedDocs++;
      }

      // Migrate chunks in batches
      const chunks = await renderPool.query<{
        id: number;
        document_id: number;
        text: string;
        chunk_index: number;
        source: string;
        pdf_url: string | null;
        subject: string | null;
        created_at: Date;
      }>('SELECT * FROM chunks ORDER BY document_id, chunk_index');

      let migratedChunks = 0;
      let skippedChunks = 0;
      const batchSize = 100;

      for (let i = 0; i < chunks.rows.length; i += batchSize) {
        const batch = chunks.rows.slice(i, i + batchSize);
        const values: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        for (const chunk of batch) {
          const newDocId = documentIdMap.get(chunk.document_id);
          if (!newDocId) {
            skippedChunks++;
            continue;
          }

          const existing = await azurePool.query<{ id: number }>(
            'SELECT id FROM chunks WHERE document_id = $1 AND chunk_index = $2',
            [newDocId, chunk.chunk_index]
          );

          if (existing.rows.length > 0) {
            skippedChunks++;
            continue;
          }

          values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`);
          params.push(newDocId, chunk.text, chunk.chunk_index, chunk.source, chunk.pdf_url, chunk.subject);
          paramIndex += 6;
        }

        if (values.length > 0) {
          await azurePool.query(
            `INSERT INTO chunks (document_id, text, chunk_index, source, pdf_url, subject)
             VALUES ${values.join(', ')}`,
            params
          );
          migratedChunks += values.length;
        }
      }

      // Final counts
      const finalDocCount = await azurePool.query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
      const finalChunkCount = await azurePool.query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');

      await renderPool.end();
      await azurePool.end();

      return NextResponse.json({
        success: true,
        summary: {
          render: {
            documents: parseInt(renderDocCount.rows[0].count),
            chunks: parseInt(renderChunkCount.rows[0].count),
          },
          migrated: {
            documents: migratedDocs,
            chunks: migratedChunks,
          },
          skipped: {
            documents: skippedDocs,
            chunks: skippedChunks,
          },
          azure: {
            documents: parseInt(finalDocCount.rows[0].count),
            chunks: parseInt(finalChunkCount.rows[0].count),
          },
        },
      });
    } catch (error: any) {
      await renderPool.end().catch(() => {});
      await azurePool.end().catch(() => {});
      throw error;
    }
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    const errorMessage = error.message || 'Migration failed';
    const errorDetails = error.code ? ` (Error code: ${error.code})` : '';
    
    // Provide more helpful error messages
    if (errorMessage.includes('SSL') || errorMessage.includes('TLS')) {
      return NextResponse.json(
        { 
          error: 'SSL/TLS connection required for Azure PostgreSQL. Please ensure your connection string includes SSL parameters.',
          details: errorMessage + errorDetails
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { 
        error: errorMessage + errorDetails,
        details: error.stack || undefined
      },
      { status: 500 }
    );
  }
}



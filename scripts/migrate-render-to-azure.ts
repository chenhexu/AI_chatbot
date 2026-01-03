/**
 * Migration script: Copy data from Render PostgreSQL to Azure PostgreSQL
 * 
 * Usage:
 * 1. Set RENDER_DATABASE_URL and AZURE_DATABASE_URL environment variables
 * 2. Run: npx tsx scripts/migrate-render-to-azure.ts
 */

import { Pool } from 'pg';

interface DocumentRecord {
  id: number;
  source_id: string;
  source_type: string;
  name: string | null;
  content: string;
  pdf_url: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ChunkRecord {
  id: number;
  document_id: number;
  text: string;
  chunk_index: number;
  source: string;
  pdf_url: string | null;
  subject: string | null;
  created_at: Date;
}

interface FailedClassificationRecord {
  id: number;
  chunk_id: number;
  error_message: string | null;
  failed_at: Date;
  retry_count: number;
}

async function migrate() {
  const renderUrl = process.env.RENDER_DATABASE_URL;
  const azureUrl = process.env.AZURE_DATABASE_URL;

  if (!renderUrl) {
    console.error('❌ RENDER_DATABASE_URL environment variable not set');
    process.exit(1);
  }

  if (!azureUrl) {
    console.error('❌ AZURE_DATABASE_URL environment variable not set');
    process.exit(1);
  }

  console.log('🚀 Starting migration from Render to Azure PostgreSQL...\n');

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
    console.log('🔌 Testing connections...');
    await renderPool.query('SELECT 1');
    console.log('✅ Connected to Render database');
    
    await azurePool.query('SELECT 1');
    console.log('✅ Connected to Azure database\n');

    // Initialize Azure schema
    console.log('📋 Initializing Azure database schema...');
    const fs = await import('fs');
    const path = await import('path');
    const schemaPath = path.join(process.cwd(), 'lib', 'database', 'schema.sql');
    const schema = await fs.promises.readFile(schemaPath, 'utf-8');
    await azurePool.query(schema);
    console.log('✅ Schema initialized\n');

    // Get counts from Render
    console.log('📊 Counting data in Render database...');
    const renderDocCount = await renderPool.query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
    const renderChunkCount = await renderPool.query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');
    const renderFailedCount = await renderPool.query<{ count: string }>('SELECT COUNT(*) as count FROM failed_classifications');
    
    console.log(`   Documents: ${renderDocCount.rows[0].count}`);
    console.log(`   Chunks: ${renderChunkCount.rows[0].count}`);
    console.log(`   Failed classifications: ${renderFailedCount.rows[0].count}\n`);

    // Check Azure database
    const azureDocCount = await azurePool.query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
    if (parseInt(azureDocCount.rows[0].count) > 0) {
      console.log('⚠️  Azure database already contains data!');
      console.log('   This script will preserve existing data and only add new documents.\n');
    }

    // Migrate documents
    console.log('📄 Migrating documents...');
    const documents = await renderPool.query<DocumentRecord>(
      'SELECT * FROM documents ORDER BY id'
    );

    const documentIdMap = new Map<number, number>(); // Render ID -> Azure ID
    let migratedDocs = 0;
    let skippedDocs = 0;

    for (const doc of documents.rows) {
      // Check if document already exists in Azure by source_id
      const existing = await azurePool.query<{ id: number }>(
        'SELECT id FROM documents WHERE source_id = $1',
        [doc.source_id]
      );

      if (existing.rows.length > 0) {
        documentIdMap.set(doc.id, existing.rows[0].id);
        skippedDocs++;
        if (skippedDocs % 50 === 0) {
          console.log(`   Skipped ${skippedDocs} existing documents...`);
        }
        continue;
      }

      const result = await azurePool.query<{ id: number }>(
        `INSERT INTO documents (source_id, source_type, name, content, pdf_url, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [doc.source_id, doc.source_type, doc.name, doc.content, doc.pdf_url, doc.created_at, doc.updated_at]
      );

      const newId = result.rows[0].id;
      documentIdMap.set(doc.id, newId);
      migratedDocs++;

      if (migratedDocs % 50 === 0) {
        console.log(`   Migrated ${migratedDocs}/${documents.rows.length} documents...`);
      }
    }

    console.log(`✅ Migrated ${migratedDocs} documents, skipped ${skippedDocs} existing\n`);

    // Migrate chunks
    console.log('🔪 Migrating chunks...');
    const chunks = await renderPool.query<ChunkRecord>(
      'SELECT * FROM chunks ORDER BY document_id, chunk_index'
    );

    let migratedChunks = 0;
    let skippedChunks = 0;

    // Process in batches of 100
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

        // Check if chunk already exists
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

      if ((i + batchSize) % 500 === 0 || i + batchSize >= chunks.rows.length) {
        console.log(`   Migrated ${Math.min(i + batchSize, chunks.rows.length)}/${chunks.rows.length} chunks...`);
      }
    }

    console.log(`✅ Migrated ${migratedChunks} chunks, skipped ${skippedChunks} existing\n`);

    // Migrate failed classifications (if table exists)
    try {
      console.log('⚠️  Migrating failed classifications...');
      const failed = await renderPool.query<FailedClassificationRecord>(
        'SELECT * FROM failed_classifications ORDER BY id'
      );

      // Get chunk ID mapping for failed classifications
      const chunkIdMap = new Map<number, number>(); // Render chunk ID -> Azure chunk ID
      
      // We need to map old chunk IDs to new chunk IDs
      // This is complex because chunk IDs are auto-increment, so we need to match by (document_id, chunk_index)
      for (const fail of failed.rows) {
        // Get the chunk from Render to find its document_id and chunk_index
        const renderChunk = await renderPool.query<ChunkRecord>(
          'SELECT document_id, chunk_index FROM chunks WHERE id = $1',
          [fail.chunk_id]
        );

        if (renderChunk.rows.length === 0) continue;

        const renderDocId = renderChunk.rows[0].document_id;
        const chunkIndex = renderChunk.rows[0].chunk_index;
        const newDocId = documentIdMap.get(renderDocId);

        if (!newDocId) continue;

        // Find the corresponding chunk in Azure
        const azureChunk = await azurePool.query<{ id: number }>(
          'SELECT id FROM chunks WHERE document_id = $1 AND chunk_index = $2',
          [newDocId, chunkIndex]
        );

        if (azureChunk.rows.length === 0) continue;

        const newChunkId = azureChunk.rows[0].id;

        // Check if already exists
        const existing = await azurePool.query<{ id: number }>(
          'SELECT id FROM failed_classifications WHERE chunk_id = $1',
          [newChunkId]
        );

        if (existing.rows.length > 0) continue;

        await azurePool.query(
          `INSERT INTO failed_classifications (chunk_id, error_message, failed_at, retry_count)
           VALUES ($1, $2, $3, $4)`,
          [newChunkId, fail.error_message, fail.failed_at, fail.retry_count]
        );
      }

      console.log(`✅ Migrated ${failed.rows.length} failed classifications\n`);
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        console.log('ℹ️  failed_classifications table does not exist in Render, skipping...\n');
      } else {
        throw error;
      }
    }

    // Final counts
    console.log('📊 Final counts in Azure database:');
    const finalDocCount = await azurePool.query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
    const finalChunkCount = await azurePool.query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');
    const finalFailedCount = await azurePool.query<{ count: string }>('SELECT COUNT(*) as count FROM failed_classifications');
    
    console.log(`   Documents: ${finalDocCount.rows[0].count}`);
    console.log(`   Chunks: ${finalChunkCount.rows[0].count}`);
    console.log(`   Failed classifications: ${finalFailedCount.rows[0].count}\n`);

    console.log('✅ Migration complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Update DATABASE_URL in Azure App Service to use Azure connection string');
    console.log('   2. Restart your App Service');
    console.log('   3. Test the connection at: https://your-app.azurewebsites.net/api/health');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await renderPool.end();
    await azurePool.end();
  }
}

// Run migration
migrate().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});



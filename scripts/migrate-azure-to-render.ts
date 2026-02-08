/**
 * Migration script: Copy data from Azure PostgreSQL to Render/other PostgreSQL
 * 
 * Usage:
 * 1. Set AZURE_DATABASE_URL and TARGET_DATABASE_URL environment variables
 * 2. Run: npx tsx scripts/migrate-azure-to-render.ts
 * 
 * This preserves all classification data (chunks.subject column)
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
  subject: string | null; // This is the classification data!
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
  const azureUrl = process.env.AZURE_DATABASE_URL;
  const targetUrl = process.env.TARGET_DATABASE_URL || process.env.RENDER_DATABASE_URL;

  if (!azureUrl) {
    console.error('❌ AZURE_DATABASE_URL environment variable not set');
    console.error('   Set it to your Azure PostgreSQL connection string');
    process.exit(1);
  }

  if (!targetUrl) {
    console.error('❌ TARGET_DATABASE_URL or RENDER_DATABASE_URL environment variable not set');
    console.error('   Set it to your target PostgreSQL connection string (Render, Supabase, etc.)');
    process.exit(1);
  }

  console.log('🚀 Starting migration from Azure to Target PostgreSQL...\n');
  console.log('📋 This will preserve all classification data (chunks.subject column)\n');

  // Azure PostgreSQL requires SSL, Render also requires SSL
  const azurePool = new Pool({ 
    connectionString: azureUrl,
    ssl: { rejectUnauthorized: false }, // Azure PostgreSQL requires SSL
  });
  
  // Render PostgreSQL requires SSL for external connections
  const targetPool = new Pool({ 
    connectionString: targetUrl,
    ssl: { rejectUnauthorized: false }, // Render requires SSL for external connections
  });

  try {
    // Test connections
    console.log('🔌 Testing connections...');
    await azurePool.query('SELECT 1');
    console.log('✅ Connected to Azure database');
    
    await targetPool.query('SELECT 1');
    console.log('✅ Connected to target database\n');

    // Initialize target schema
    console.log('📋 Initializing target database schema...');
    const fs = await import('fs');
    const path = await import('path');
    const schemaPath = path.join(process.cwd(), 'lib', 'database', 'schema.sql');
    const schema = await fs.promises.readFile(schemaPath, 'utf-8');
    await targetPool.query(schema);
    console.log('✅ Schema initialized\n');

    // Get counts and size estimates from Azure
    console.log('📊 Analyzing Azure database...');
    const azureDocCount = await azurePool.query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
    const azureChunkCount = await azurePool.query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');
    const azureFailedCount = await azurePool.query<{ count: string }>('SELECT COUNT(*) as count FROM failed_classifications');
    
    // Estimate size
    const dbSize = await azurePool.query<{ 
      total_size: string;
    }>(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as total_size
    `);
    
    console.log(`   Documents: ${azureDocCount.rows[0].count}`);
    console.log(`   Chunks: ${azureChunkCount.rows[0].count}`);
    console.log(`   Failed classifications: ${azureFailedCount.rows[0].count}`);
    if (dbSize.rows[0]) {
      console.log(`   Database size: ${dbSize.rows[0].total_size || 'N/A'}`);
    }
    console.log();

    // Check target database
    const targetDocCount = await targetPool.query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
    if (parseInt(targetDocCount.rows[0].count) > 0) {
      console.log('⚠️  Target database already contains data!');
      console.log('   This script will preserve existing data and only add new documents.\n');
    }

    // Migrate documents
    console.log('📄 Migrating documents...');
    const documents = await azurePool.query<DocumentRecord>(
      'SELECT * FROM documents ORDER BY id'
    );

    const documentIdMap = new Map<number, number>(); // Azure ID -> Target ID
    let migratedDocs = 0;
    let skippedDocs = 0;

    for (const doc of documents.rows) {
      // Check if document already exists in target by source_id
      const existing = await targetPool.query<{ id: number }>(
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

      const result = await targetPool.query<{ id: number }>(
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

    // Migrate chunks (WITH classification data - subject column)
    console.log('🔪 Migrating chunks (including classification data)...');
    const chunks = await azurePool.query<ChunkRecord>(
      'SELECT * FROM chunks ORDER BY document_id, chunk_index'
    );

    let migratedChunks = 0;
    let skippedChunks = 0;
    let classifiedChunks = 0;

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
        const existing = await targetPool.query<{ id: number }>(
          'SELECT id FROM chunks WHERE document_id = $1 AND chunk_index = $2',
          [newDocId, chunk.chunk_index]
        );

        if (existing.rows.length > 0) {
          // Update existing chunk's subject if it's null but we have a classification
          const existingChunk = await targetPool.query<{ subject: string | null }>(
            'SELECT subject FROM chunks WHERE id = $1',
            [existing.rows[0].id]
          );
          if (existingChunk.rows[0]?.subject === null && chunk.subject) {
            await targetPool.query(
              'UPDATE chunks SET subject = $1 WHERE id = $2',
              [chunk.subject, existing.rows[0].id]
            );
            classifiedChunks++;
          }
          skippedChunks++;
          continue;
        }

        values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`);
        params.push(newDocId, chunk.text, chunk.chunk_index, chunk.source, chunk.pdf_url, chunk.subject);
        paramIndex += 6;
        
        if (chunk.subject) {
          classifiedChunks++;
        }
      }

      if (values.length > 0) {
        await targetPool.query(
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

    console.log(`✅ Migrated ${migratedChunks} chunks, skipped ${skippedChunks} existing`);
    console.log(`   📊 ${classifiedChunks} chunks have classification data (subject column)\n`);

    // Migrate failed classifications (if table exists)
    try {
      console.log('⚠️  Migrating failed classifications...');
      const failed = await azurePool.query<FailedClassificationRecord>(
        'SELECT * FROM failed_classifications ORDER BY id'
      );

      // Get chunk ID mapping for failed classifications
      const chunkIdMap = new Map<number, number>(); // Azure chunk ID -> Target chunk ID
      
      for (const fail of failed.rows) {
        // Get the chunk from Azure to find its document_id and chunk_index
        const azureChunk = await azurePool.query<ChunkRecord>(
          'SELECT document_id, chunk_index FROM chunks WHERE id = $1',
          [fail.chunk_id]
        );

        if (azureChunk.rows.length === 0) continue;

        const azureDocId = azureChunk.rows[0].document_id;
        const chunkIndex = azureChunk.rows[0].chunk_index;
        const newDocId = documentIdMap.get(azureDocId);

        if (!newDocId) continue;

        // Find the corresponding chunk in target
        const targetChunk = await targetPool.query<{ id: number }>(
          'SELECT id FROM chunks WHERE document_id = $1 AND chunk_index = $2',
          [newDocId, chunkIndex]
        );

        if (targetChunk.rows.length === 0) continue;

        const newChunkId = targetChunk.rows[0].id;

        // Check if already exists
        const existing = await targetPool.query<{ id: number }>(
          'SELECT id FROM failed_classifications WHERE chunk_id = $1',
          [newChunkId]
        );

        if (existing.rows.length > 0) continue;

        await targetPool.query(
          `INSERT INTO failed_classifications (chunk_id, error_message, failed_at, retry_count)
           VALUES ($1, $2, $3, $4)`,
          [newChunkId, fail.error_message, fail.failed_at, fail.retry_count]
        );
      }

      console.log(`✅ Migrated ${failed.rows.length} failed classifications\n`);
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        console.log('ℹ️  failed_classifications table does not exist in Azure, skipping...\n');
      } else {
        throw error;
      }
    }

    // Final counts
    console.log('📊 Final counts in target database:');
    const finalDocCount = await targetPool.query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
    const finalChunkCount = await targetPool.query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');
    const finalFailedCount = await targetPool.query<{ count: string }>('SELECT COUNT(*) as count FROM failed_classifications');
    
    // Count classified chunks
    const classifiedCount = await targetPool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM chunks WHERE subject IS NOT NULL'
    );
    
    console.log(`   Documents: ${finalDocCount.rows[0].count}`);
    console.log(`   Chunks: ${finalChunkCount.rows[0].count}`);
    console.log(`   Classified chunks: ${classifiedCount.rows[0].count}`);
    console.log(`   Failed classifications: ${finalFailedCount.rows[0].count}\n`);

    console.log('✅ Migration complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Update DATABASE_URL in your app to use the target connection string');
    console.log('   2. Restart your application');
    console.log('   3. Test the connection');
    console.log('   4. Verify classification data is working: check chunks.subject column');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await azurePool.end();
    await targetPool.end();
  }
}

// Run migration
migrate().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

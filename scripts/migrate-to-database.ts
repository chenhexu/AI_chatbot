/**
 * Migration script: Import existing filesystem data into PostgreSQL database
 * Run this once to migrate your existing data/scraped/ folder to the database
 */

import * as path from 'path';
import { loadAllDocuments } from '../lib/documentLoader';
import { processDocuments } from '../lib/rag';
import { initializeDatabase, closeDatabase } from '../lib/database/client';
import { storeDocument, storeChunks, clearAllData } from '../lib/database/documentStore';

async function migrate() {
  console.log('🚀 Starting migration to database...\n');

  try {
    // Initialize database schema
    console.log('📋 Initializing database schema...');
    await initializeDatabase();

    // Check if database already has data
    const { getDocumentCount } = await import('../lib/database/documentStore');
    const existingCount = await getDocumentCount();
    
    if (existingCount > 0) {
      console.log(`⚠️  Database already contains ${existingCount} documents.`);
      console.log('   Clearing existing data...');
      await clearAllData();
    }

    // Load documents from filesystem (existing method)
    console.log('\n📂 Loading documents from filesystem...');
    const documents = await loadAllDocuments();
    console.log(`✅ Loaded ${documents.length} documents from filesystem`);

    // Process documents into chunks
    console.log('\n🔪 Processing documents into chunks...');
    const { processDocuments } = await import('../lib/rag');
    const chunks = processDocuments(documents);
    console.log(`✅ Created ${chunks.length} chunks`);

    // Store documents and chunks in database
    console.log('\n💾 Storing in database...');
    let storedDocs = 0;
    let storedChunks = 0;

    // Group chunks by document source
    const chunksBySource = new Map<string, typeof chunks>();
    for (const chunk of chunks) {
      if (!chunksBySource.has(chunk.source)) {
        chunksBySource.set(chunk.source, []);
      }
      chunksBySource.get(chunk.source)!.push(chunk);
    }

    // Store each document
    for (const doc of documents) {
      const documentId = await storeDocument(
        doc.id,
        doc.id.startsWith('file://') ? 'file' : 'external',
        doc.content,
        doc.id.split('/').pop() || doc.id,
        doc.pdfUrl
      );

      // Store chunks for this document
      const docChunks = chunksBySource.get(doc.id) || [];
      if (docChunks.length > 0) {
        await storeChunks(
          documentId,
          docChunks.map(chunk => ({
            text: chunk.text,
            index: chunk.index,
            source: chunk.source,
            pdfUrl: chunk.pdfUrl,
          }))
        );
        storedChunks += docChunks.length;
      }

      storedDocs++;
      if (storedDocs % 10 === 0) {
        console.log(`   Stored ${storedDocs}/${documents.length} documents...`);
      }
    }

    console.log(`\n✅ Migration complete!`);
    console.log(`   - Documents: ${storedDocs}`);
    console.log(`   - Chunks: ${storedChunks}`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await closeDatabase();
  }
}

// Run migration
migrate().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


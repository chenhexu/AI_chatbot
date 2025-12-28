import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, closeDatabase } from '@/lib/database/client';
import { loadAllDocuments } from '@/lib/documentLoader';
import { processDocuments } from '@/lib/rag';
import { storeDocument, storeChunks, clearAllData, getDocumentCount, getChunkCount } from '@/lib/database/documentStore';

/**
 * API endpoint to migrate data from filesystem to database
 * This can be called from the browser since Render free tier doesn't have shell access
 * 
 * GET /api/migrate - Check migration status
 * POST /api/migrate - Run migration
 */
export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set', status: 'not_configured' },
        { status: 400 }
      );
    }

    const docCount = await getDocumentCount();
    const chunkCount = await getChunkCount();

    return NextResponse.json({
      status: 'ready',
      documents: docCount,
      chunks: chunkCount,
      message: docCount > 0 
        ? `Database has ${docCount} documents and ${chunkCount} chunks`
        : 'Database is empty. Run migration to populate it.'
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to check migration status',
        details: error instanceof Error ? error.message : String(error),
        status: 'error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set', status: 'not_configured' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const force = body.force === true; // Allow forcing re-migration

    console.log('🚀 Starting migration to database...');

    // Initialize database schema
    console.log('📋 Initializing database schema...');
    await initializeDatabase();

    // Check if database already has data
    const existingCount = await getDocumentCount();
    
    if (existingCount > 0 && !force) {
      return NextResponse.json({
        status: 'already_migrated',
        documents: existingCount,
        chunks: await getChunkCount(),
        message: 'Database already contains data. Use force=true to re-migrate.'
      });
    }

    if (existingCount > 0 && force) {
      console.log(`⚠️  Clearing existing ${existingCount} documents...`);
      await clearAllData();
    }

    // Load documents from filesystem
    console.log('📂 Loading documents from filesystem...');
    const documents = await loadAllDocuments();
    console.log(`✅ Loaded ${documents.length} documents from filesystem`);

    if (documents.length === 0) {
      return NextResponse.json({
        status: 'no_data',
        message: 'No documents found in filesystem. Make sure data/scraped/ folder has data.'
      });
    }

    // Process documents into chunks
    console.log('🔪 Processing documents into chunks...');
    const chunks = processDocuments(documents);
    console.log(`✅ Created ${chunks.length} chunks`);

    // Store documents and chunks in database
    console.log('💾 Storing in database...');
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
    }

    await closeDatabase();

    console.log(`✅ Migration complete! Documents: ${storedDocs}, Chunks: ${storedChunks}`);

    return NextResponse.json({
      status: 'success',
      documents: storedDocs,
      chunks: storedChunks,
      message: `Successfully migrated ${storedDocs} documents and ${storedChunks} chunks to database`
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await closeDatabase().catch(() => {}); // Try to close, but don't fail if it errors
    
    return NextResponse.json(
      { 
        error: 'Migration failed',
        details: error instanceof Error ? error.message : String(error),
        status: 'error'
      },
      { status: 500 }
    );
  }
}


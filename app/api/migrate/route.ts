import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, closeDatabase } from '@/lib/database/client';
import { 
  storeDocument, 
  storeChunks, 
  clearAllData, 
  getDocumentCount, 
  getChunkCount,
  ensureEmbeddingColumn,
  getEmbeddingStats,
  getChunksWithoutEmbeddings,
  updateChunkEmbeddingsBatch
} from '@/lib/database/documentStore';
import { generateEmbeddingsBatch } from '@/lib/embeddings';

// Dynamic imports for heavy modules to reduce serverless bundle size
async function loadAndProcessDocuments() {
  const { loadAllDocuments } = await import('@/lib/documentLoader');
  const { processDocuments } = await import('@/lib/rag');
  const documents = await loadAllDocuments();
  const chunks = processDocuments(documents);
  return { documents, chunks };
}

/**
 * API endpoint to migrate data from filesystem to database
 * This can be called from the browser since Render free tier doesn't have shell access
 * 
 * GET /api/migrate - Check migration status
 * POST /api/migrate - Run migration
 * POST /api/migrate?action=embeddings - Generate embeddings for chunks
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
    
    // Get embedding stats
    let embeddingStats = { total: 0, withEmbedding: 0, withoutEmbedding: 0 };
    try {
      embeddingStats = await getEmbeddingStats();
    } catch (e) {
      // Embedding column might not exist yet
      console.log('Embedding stats not available (column may not exist yet)');
    }

    return NextResponse.json({
      status: 'ready',
      documents: docCount,
      chunks: chunkCount,
      embeddings: embeddingStats,
      message: docCount > 0 
        ? `Database has ${docCount} documents and ${chunkCount} chunks (${embeddingStats.withEmbedding} with embeddings)`
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
    const action = body.action as string | undefined;
    const force = body.force === true; // Allow forcing re-migration

    // Handle embedding generation action
    if (action === 'embeddings') {
      return await handleEmbeddingGeneration(body.batchSize || 50);
    }

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

    // Load documents from filesystem (dynamic import to reduce bundle size)
    console.log('📂 Loading documents from filesystem...');
    const { documents, chunks } = await loadAndProcessDocuments();
    console.log(`✅ Loaded ${documents.length} documents, created ${chunks.length} chunks`);

    if (documents.length === 0) {
      return NextResponse.json({
        status: 'no_data',
        message: 'No documents found in filesystem. Make sure data/scraped/ folder has data.'
      });
    }

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

/**
 * Handle embedding generation for chunks
 */
async function handleEmbeddingGeneration(batchSize: number = 50) {
  try {
    console.log('🧠 Starting embedding generation...');
    
    // Ensure embedding column exists
    await ensureEmbeddingColumn();
    
    // Get chunks without embeddings
    const chunksToProcess = await getChunksWithoutEmbeddings();
    
    if (chunksToProcess.length === 0) {
      const stats = await getEmbeddingStats();
      return NextResponse.json({
        status: 'complete',
        processed: 0,
        remaining: 0,
        total: stats.total,
        message: 'All chunks already have embeddings'
      });
    }
    
    console.log(`📊 Found ${chunksToProcess.length} chunks without embeddings`);
    
    // Process in batches
    const batch = chunksToProcess.slice(0, batchSize);
    const texts = batch.map(c => c.text);
    
    console.log(`🔄 Generating embeddings for ${batch.length} chunks...`);
    const embeddings = await generateEmbeddingsBatch(texts);
    
    // Update database with embeddings
    const updates = batch.map((chunk, i) => ({
      id: chunk.id,
      embedding: embeddings[i],
    }));
    
    console.log(`💾 Saving embeddings to database...`);
    await updateChunkEmbeddingsBatch(updates);
    
    const stats = await getEmbeddingStats();
    const remaining = chunksToProcess.length - batch.length;
    
    console.log(`✅ Generated ${batch.length} embeddings. ${remaining} remaining.`);
    
    return NextResponse.json({
      status: remaining > 0 ? 'in_progress' : 'complete',
      processed: batch.length,
      remaining,
      total: stats.total,
      withEmbedding: stats.withEmbedding,
      message: remaining > 0 
        ? `Generated ${batch.length} embeddings. ${remaining} remaining. Call again to continue.`
        : `All ${stats.total} chunks now have embeddings.`
    });
    
  } catch (error) {
    console.error('❌ Embedding generation failed:', error);
    
    return NextResponse.json(
      {
        error: 'Embedding generation failed',
        details: error instanceof Error ? error.message : String(error),
        status: 'error'
      },
      { status: 500 }
    );
  }
}


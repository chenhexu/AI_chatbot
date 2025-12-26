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

/**
 * API endpoint to check migration status and generate embeddings
 * NOTE: For Vercel, migration must be done via /api/upload-data endpoint
 * This keeps the bundle small by not including heavy OCR dependencies
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
    
    // Ensure embedding column exists before getting stats
    let embeddingStats = { total: chunkCount, withEmbedding: 0, withoutEmbedding: chunkCount };
    try {
      await ensureEmbeddingColumn();
      const stats = await getEmbeddingStats();
      // Only use stats if they're valid (total > 0 or matches chunkCount)
      if (stats.total > 0 || stats.total === chunkCount) {
        embeddingStats = stats;
      } else {
        console.log(`Stats mismatch: stats.total=${stats.total}, chunkCount=${chunkCount}, using chunkCount`);
        embeddingStats = { total: chunkCount, withEmbedding: stats.withEmbedding, withoutEmbedding: chunkCount - stats.withEmbedding };
      }
    } catch (e) {
      console.error('Error getting embedding stats:', e);
      // If stats fail, use chunk count as total
      embeddingStats = { total: chunkCount, withEmbedding: 0, withoutEmbedding: chunkCount };
    }

    return NextResponse.json({
      status: 'ready',
      documents: docCount,
      chunks: chunkCount,
      embeddings: embeddingStats,
      message: docCount > 0 
        ? `Database has ${docCount} documents and ${chunkCount} chunks (${embeddingStats.withEmbedding} with embeddings)`
        : 'Database is empty. Upload data first via /admin/migrate'
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to check status',
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

    // Handle embedding generation action
    if (action === 'embeddings') {
      return await handleEmbeddingGeneration(body.batchSize || 50);
    }

    // Handle clear action
    if (action === 'clear') {
      await clearAllData();
      return NextResponse.json({
        status: 'success',
        message: 'All data cleared'
      });
    }

    // Handle direct data upload (chunks already processed)
    if (action === 'upload' && body.documents) {
      return await handleDataUpload(body.documents, body.force === true);
    }

    return NextResponse.json({
      error: 'Invalid action',
      message: 'Use action: "embeddings", "clear", or "upload"'
    }, { status: 400 });

  } catch (error) {
    console.error('❌ Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Operation failed',
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
    console.log('🧠 Generating embeddings...');
    
    await ensureEmbeddingColumn();
    
    const chunksToProcess = await getChunksWithoutEmbeddings();
    
    if (chunksToProcess.length === 0) {
      const stats = await getEmbeddingStats();
      return NextResponse.json({
        status: 'complete',
        processed: 0,
        remaining: 0,
        total: stats.total,
        message: 'All chunks have embeddings'
      });
    }
    
    const batch = chunksToProcess.slice(0, batchSize);
    const texts = batch.map(c => c.text);
    
    console.log(`🔄 Generating ${batch.length} embeddings...`);
    const embeddings = await generateEmbeddingsBatch(texts);
    
    const updates = batch.map((chunk, i) => ({
      id: chunk.id,
      embedding: embeddings[i],
    }));
    
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
        ? `Generated ${batch.length} embeddings. ${remaining} remaining.`
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

/**
 * Handle direct data upload (pre-processed documents)
 */
async function handleDataUpload(
  documents: Array<{ id: string; content: string; pdfUrl?: string }>,
  force: boolean = false
) {
  try {
    console.log('📤 Uploading data...');
    
    await initializeDatabase();
    
    const existingCount = await getDocumentCount();
    
    if (existingCount > 0 && !force) {
      return NextResponse.json({
        status: 'already_exists',
        documents: existingCount,
        message: 'Database has data. Use force=true to replace.'
      });
    }
    
    if (existingCount > 0 && force) {
      await clearAllData();
    }
    
    // Simple chunking function
    const chunkText = (text: string, maxLength: number = 1500): string[] => {
      const chunks: string[] = [];
      const paragraphs = text.split(/\n\n+/);
      let currentChunk = '';
      
      for (const para of paragraphs) {
        if ((currentChunk + para).length > maxLength && currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = para;
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + para;
        }
      }
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      return chunks.length > 0 ? chunks : [text];
    };
    
    let storedDocs = 0;
    let storedChunks = 0;
    
    for (const doc of documents) {
      const docId = await storeDocument(
        doc.id,
        'uploaded',
        doc.content,
        doc.id.split('/').pop() || doc.id,
        doc.pdfUrl
      );
      
      const textChunks = chunkText(doc.content);
      if (textChunks.length > 0) {
        await storeChunks(
          docId,
          textChunks.map((text, index) => ({
            text,
            index,
            source: doc.id,
            pdfUrl: doc.pdfUrl,
          }))
        );
        storedChunks += textChunks.length;
      }
      storedDocs++;
    }
    
    await closeDatabase();
    
    return NextResponse.json({
      status: 'success',
      documents: storedDocs,
      chunks: storedChunks,
      message: `Uploaded ${storedDocs} documents, ${storedChunks} chunks`
    });
    
  } catch (error) {
    await closeDatabase().catch(() => {});
    throw error;
  }
}

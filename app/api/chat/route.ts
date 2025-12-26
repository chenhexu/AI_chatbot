import { NextRequest, NextResponse } from 'next/server';
import { type TextChunkWithEmbedding } from '@/lib/rag';
import { generateChatResponse } from '@/lib/openai';
import { loadAllChunksWithEmbeddings } from '@/lib/database/documentStore';
import { query } from '@/lib/database/client';

// Cache document chunks in memory
let cachedChunks: TextChunkWithEmbedding[] | null = null;
let chunksLastFetched: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
let isLoadingDocuments = false;

/**
 * Get document chunks from database
 * NOTE: This route is database-only for production (Vercel)
 * Heavy OCR dependencies are excluded to stay under 250MB limit
 */
async function getDocumentChunks(): Promise<TextChunkWithEmbedding[]> {
  const now = Date.now();
  
  // Return cached chunks if still valid
  if (cachedChunks && cachedChunks.length > 0 && (now - chunksLastFetched) < CACHE_DURATION) {
    const withEmbeddings = cachedChunks.filter(c => c.embedding).length;
    console.log(`✅ Using cached chunks (${cachedChunks.length} chunks, ${withEmbeddings} with embeddings)`);
    return cachedChunks;
  }
  
  // Clear empty cache if DATABASE_URL is set
  if (cachedChunks && cachedChunks.length === 0 && process.env.DATABASE_URL) {
    cachedChunks = null;
    chunksLastFetched = 0;
  }
  
  // If already loading, wait for it
  if (isLoadingDocuments) {
    const maxWait = 30000;
    const pollInterval = 100;
    let waited = 0;
    while (isLoadingDocuments && waited < maxWait) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      waited += pollInterval;
      if (cachedChunks && cachedChunks.length > 0) {
        return cachedChunks;
      }
    }
  }
  
  isLoadingDocuments = true;
  try {
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl) {
      throw new Error('DATABASE_URL is required. Set it in your environment variables.');
    }
    
    console.log('🔍 Loading chunks from database...');
    
    // Check if tables exist
    try {
      await query('SELECT 1 FROM chunks LIMIT 1');
    } catch (schemaError: any) {
      if (schemaError?.code === '42P01' || schemaError?.message?.includes('does not exist')) {
        console.log('📋 Initializing database schema...');
        const { initializeDatabase } = await import('@/lib/database/client');
        await initializeDatabase();
      } else {
        throw schemaError;
      }
    }
    
    // Load chunks with embeddings
    const dbChunks = await loadAllChunksWithEmbeddings();
    const withEmbeddings = dbChunks.filter(c => c.embedding).length;
    
    if (dbChunks.length > 0) {
      cachedChunks = dbChunks;
      chunksLastFetched = Date.now();
      console.log(`✅ Loaded ${dbChunks.length} chunks (${withEmbeddings} with embeddings)`);
      return cachedChunks;
    }
    
    // Database is empty
    console.warn('⚠️ Database is empty. Run migration first: /admin/migrate');
    cachedChunks = [];
    chunksLastFetched = Date.now();
    return cachedChunks;
    
  } catch (error) {
    console.error('Error loading chunks:', error);
    if (cachedChunks) return cachedChunks;
    throw error;
  } finally {
    isLoadingDocuments = false;
  }
}

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(2, 8);
  
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    console.log(`[${requestId}] 📨 Query: "${message}"`);

    const chunks = await getDocumentChunks();
    console.log(`[${requestId}] 🔍 ${chunks.length} chunks available`);

    const response = await generateChatResponse(message, chunks, requestId);

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process chat message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const chunks = await getDocumentChunks();
    return NextResponse.json({ 
      message: 'Documents loaded',
      chunksCount: chunks.length 
    });
  } catch (error) {
    console.error('GET /api/chat error:', error);
    return NextResponse.json(
      { error: 'Failed to load documents', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

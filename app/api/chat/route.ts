import { NextRequest, NextResponse } from 'next/server';
import { loadAllDocuments } from '@/lib/documentLoader';
import { processDocuments, type TextChunk } from '@/lib/rag';
import { generateChatResponse } from '@/lib/openai';
import { loadAllChunks } from '@/lib/database/documentStore';
import { query } from '@/lib/database/client';

// Cache document chunks in memory (in production, consider using Redis or similar)
let cachedChunks: TextChunk[] | null = null;
let chunksLastFetched: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
let isLoadingDocuments = false; // Prevent concurrent loading

/**
 * Preload document chunks (call this on app startup)
 * Note: This function is not exported because Next.js route files can only export HTTP handlers
 * It's kept here for reference but should be called from elsewhere if needed
 */
async function preloadDocumentChunks(): Promise<void> {
  // Trigger cache load in background (don't await to avoid blocking)
  getDocumentChunks().catch(error => {
    console.error('Background preload error (non-critical):', error);
  });
}

/**
 * Get document chunks, using cache if available
 */
async function getDocumentChunks(): Promise<TextChunk[]> {
  const now = Date.now();
  
  // Return cached chunks if still valid
  if (cachedChunks && (now - chunksLastFetched) < CACHE_DURATION) {
    return cachedChunks;
  }
  
  // If already loading, wait for it to complete
  if (isLoadingDocuments) {
    // Wait for loading to complete (poll every 100ms, max 30 seconds)
    const maxWait = 30000;
    const pollInterval = 100;
    let waited = 0;
    while (isLoadingDocuments && waited < maxWait) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      waited += pollInterval;
      // Check if cache is now available
      if (cachedChunks && (Date.now() - chunksLastFetched) < CACHE_DURATION) {
        return cachedChunks;
      }
    }
    // If still loading after max wait, proceed (might be stuck)
  }
  
  // Try to load from database first (production mode)
  // Fall back to filesystem if database is not available
  isLoadingDocuments = true;
  try {
    // Check if DATABASE_URL is set (database mode)
    if (process.env.DATABASE_URL) {
      try {
        console.log('🔍 Attempting to load chunks from database...');
        
        // First, check if tables exist, if not initialize schema
        try {
          await query('SELECT 1 FROM chunks LIMIT 1');
        } catch (schemaError: any) {
          // If table doesn't exist, initialize schema
          if (schemaError?.code === '42P01' || schemaError?.message?.includes('does not exist')) {
            console.log('📋 Database tables not found, initializing schema...');
            const { initializeDatabase } = await import('@/lib/database/client');
            await initializeDatabase();
            console.log('✅ Database schema initialized');
          } else {
            throw schemaError;
          }
        }
        
        const dbChunks = await loadAllChunks();
        console.log(`📊 Database query returned ${dbChunks.length} chunks`);
        if (dbChunks.length > 0) {
          cachedChunks = dbChunks;
          chunksLastFetched = Date.now();
          console.log(`✅ Loaded ${dbChunks.length} chunks from database`);
          return cachedChunks;
        } else {
          console.log('⚠️  Database is empty (0 chunks found), falling back to filesystem...');
        }
      } catch (dbError) {
        const errorDetails = dbError instanceof Error ? dbError.message : String(dbError);
        const errorStack = dbError instanceof Error ? dbError.stack : undefined;
        console.error('❌ Database error when loading chunks:', errorDetails);
        if (errorStack) {
          console.error('Stack trace:', errorStack);
        }
        console.warn('⚠️  Falling back to filesystem due to database error');
      }
    } else {
      console.log('ℹ️  DATABASE_URL not set, using filesystem...');
    }

    // Fallback to filesystem (development or if database is empty)
    const documents = await loadAllDocuments();
    cachedChunks = processDocuments(documents);
    chunksLastFetched = Date.now();
    console.log(`✅ Loaded ${documents.length} documents from filesystem, created ${cachedChunks.length} chunks for RAG`);
    return cachedChunks;
  } catch (error) {
    console.error('Error fetching documents:', error);
    // Return cached chunks even if expired, if available
    if (cachedChunks) {
      return cachedChunks;
    }
    throw error;
  } finally {
    isLoadingDocuments = false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Get document chunks (includes scraped data from data/scraped/)
    const chunks = await getDocumentChunks();
    console.log(`🔍 Processing query with ${chunks.length} total chunks available`);

    // Generate response using OpenAI with RAG
    const response = await generateChatResponse(message, chunks);

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

// Optional: Add GET endpoint to refresh document cache
export async function GET() {
  try {
    const documents = await loadAllDocuments();
    cachedChunks = processDocuments(documents);
    chunksLastFetched = Date.now();
    return NextResponse.json({ 
      message: 'Documents refreshed successfully',
      chunksCount: cachedChunks.length 
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to refresh documents' },
      { status: 500 }
    );
  }
}



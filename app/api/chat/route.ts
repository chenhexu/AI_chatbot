import { NextRequest, NextResponse } from 'next/server';
import { loadAllDocuments } from '@/lib/documentLoader';
import { processDocuments, type TextChunk } from '@/lib/rag';
import { generateChatResponse } from '@/lib/openai';

// Cache document chunks in memory (in production, consider using Redis or similar)
let cachedChunks: TextChunk[] | null = null;
let chunksLastFetched: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Get document chunks, using cache if available
 */
async function getDocumentChunks(): Promise<TextChunk[]> {
  const now = Date.now();
  
  // Return cached chunks if still valid
  if (cachedChunks && (now - chunksLastFetched) < CACHE_DURATION) {
    return cachedChunks;
  }
  
  // Fetch fresh documents using document loader
  // Document loader handles all formats (Google Docs, PDF, Excel, etc.)
  // and converts them to raw text for RAG
  try {
    const documents = await loadAllDocuments();
    cachedChunks = processDocuments(documents);
    chunksLastFetched = now;
    return cachedChunks;
  } catch (error) {
    console.error('Error fetching documents:', error);
    // Return cached chunks even if expired, if available
    if (cachedChunks) {
      return cachedChunks;
    }
    throw error;
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

    // Get document chunks
    const chunks = await getDocumentChunks();

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



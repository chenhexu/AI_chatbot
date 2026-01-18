import { NextRequest, NextResponse } from 'next/server';
import { loadAllDocuments } from '@/lib/documentLoader';
import { processDocuments, type TextChunk } from '@/lib/rag';
import { generateChatResponse } from '@/lib/openai';
import { loadAllChunks } from '@/lib/database/documentStore';
import { query } from '@/lib/database/client';
import { classifyQuerySubject } from '@/lib/subjectClassifier';
import { expandAndTranslateQuery } from '@/lib/queryExpander';
import os from 'os';

// Cache document chunks in memory (in production, consider using Redis or similar)
let cachedChunks: TextChunk[] | null = null;
let chunksLastFetched: number = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
let isLoadingDocuments = false; // Prevent concurrent loading

/**
 * Log CPU usage with a label
 */
function logCpuUsage(requestId: string, label: string, startCpu?: NodeJS.CpuUsage): NodeJS.CpuUsage {
  const currentCpu = process.cpuUsage();
  const cpus = os.cpus();
  const numCores = cpus.length;
  
  if (startCpu) {
    // Calculate delta
    const userDelta = (currentCpu.user - startCpu.user) / 1000; // Convert to ms
    const systemDelta = (currentCpu.system - startCpu.system) / 1000;
    const totalDelta = userDelta + systemDelta;
    
    console.log(`[${requestId}] 💻 CPU [${label}]: ${totalDelta.toFixed(2)}ms (user: ${userDelta.toFixed(2)}ms, system: ${systemDelta.toFixed(2)}ms) | Cores: ${numCores}`);
  } else {
    // Just log current state
    const totalMs = (currentCpu.user + currentCpu.system) / 1000;
    console.log(`[${requestId}] 💻 CPU [${label}]: ${totalMs.toFixed(2)}ms total | Cores: ${numCores}`);
  }
  
  return currentCpu;
}

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
  
  // Return cached chunks if still valid AND not empty (if we have DATABASE_URL, don't use empty cache)
  if (cachedChunks && (now - chunksLastFetched) < CACHE_DURATION) {
    // If we have DATABASE_URL but cache is empty, don't use cache - try database again
    if (process.env.DATABASE_URL && cachedChunks.length === 0) {
      console.log('⚠️  Cache is empty but DATABASE_URL is set, clearing cache and retrying database...');
      cachedChunks = null;
      chunksLastFetched = 0;
    } else {
      console.log(`✅ Using cached chunks (${cachedChunks.length} chunks, cached ${Math.round((now - chunksLastFetched) / 1000)}s ago)`);
      return cachedChunks;
    }
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
    const dbUrl = process.env.DATABASE_URL;
    console.log(`🔍 DATABASE_URL is ${dbUrl ? 'SET' : 'NOT SET'}`);
    
    if (dbUrl) {
      try {
        console.log('🔍 Attempting to load chunks from database...');
        console.log('📡 Executing database query to load chunks...');
        
        // First, check if tables exist, if not initialize schema
        try {
          await query('SELECT 1 FROM chunks LIMIT 1');
          console.log('✅ Database tables exist');
        } catch (schemaError: any) {
          // If table doesn't exist, initialize schema
          if (schemaError?.code === '42P01' || schemaError?.message?.includes('does not exist')) {
            console.log('📋 Database tables not found, initializing schema...');
            const { initializeDatabase } = await import('@/lib/database/client');
            await initializeDatabase();
            console.log('✅ Database schema initialized');
          } else {
            console.error('❌ Schema check error:', schemaError);
            throw schemaError;
          }
        }
        
        console.log('📡 Loading chunks from database...');
        const dbChunks = await loadAllChunks();
        console.log(`📊 Query returned ${dbChunks.length} rows`);
        console.log(`📊 Database query returned ${dbChunks.length} chunks`);
        if (dbChunks.length > 0) {
          cachedChunks = dbChunks;
          chunksLastFetched = Date.now();
          console.log(`✅ Successfully loaded ${dbChunks.length} chunks from database`);
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
  // Generate a short request ID for logging
  const requestId = Math.random().toString(36).substring(2, 8);
  
  // Track CPU usage throughout the request
  const requestStartCpu = process.cpuUsage();
  const requestStartTime = Date.now();
  
  try {
    const body = await request.json();
    const { message, provider = 'openai' } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Print separator for readability in logs
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${requestId}] 📨 Received query: "${message}" (provider: ${provider})`);
    logCpuUsage(requestId, 'Request Start');

    // Step 1: Classify query subject (fast Gemini call ~300ms) - can be disabled via env var
    const enableSubjectFilter = process.env.ENABLE_SUBJECT_FILTER !== 'false';
    let querySubjects: string[] = [];
    
    if (enableSubjectFilter) {
      const subjectStartCpu = process.cpuUsage();
      console.log(`[${requestId}] 🧠 Classifying query subject...`);
      try {
        querySubjects = await classifyQuerySubject(message);
        logCpuUsage(requestId, 'Subject Classification', subjectStartCpu);
        console.log(`[${requestId}] ✅ Query subjects: ${querySubjects.join(', ')}`);
      } catch (error) {
        logCpuUsage(requestId, 'Subject Classification (failed)', subjectStartCpu);
        console.error(`[${requestId}] ⚠️ Subject classification failed, using all chunks:`, error);
        querySubjects = []; // Fallback to all chunks
      }
    } else {
      console.log(`[${requestId}] ⏭️ Subject classification disabled (ENABLE_SUBJECT_FILTER=false), using all chunks`);
    }

    // Step 2: Expand and translate query for better retrieval (Gemini)
    const expandStartCpu = process.cpuUsage();
    let expandedQuery = message;
    try {
      expandedQuery = await expandAndTranslateQuery(message);
      logCpuUsage(requestId, 'Query Expansion/Translation', expandStartCpu);
      console.log(`[${requestId}] 🔍 Expanded query: "${expandedQuery.substring(0, 200)}${expandedQuery.length > 200 ? '...' : ''}"`);
    } catch (error) {
      logCpuUsage(requestId, 'Query Expansion/Translation (failed)', expandStartCpu);
      console.error(`[${requestId}] ⚠️ Query expansion failed, using original query:`, error);
      expandedQuery = message; // Fallback to original
    }

    // Step 3: Load chunks filtered by subject (much faster!)
    const chunkLoadStartCpu = process.cpuUsage();
    const chunkLoadStartTime = Date.now();
    let chunks: TextChunk[];
    if (process.env.DATABASE_URL && querySubjects.length > 0 && enableSubjectFilter) {
      // Try to load from database with subject filter
      try {
        chunks = await loadAllChunks(querySubjects);
        // Classification is complete - use filtered chunks (subject filtering is working)
        if (chunks.length === 0) {
          // Only fallback if we got zero chunks (likely a classification issue)
          console.log(`[${requestId}] ⚠️ No chunks found with subject filter, loading all chunks as fallback...`);
          chunks = await loadAllChunks(); // Load all chunks
        } else {
          console.log(`[${requestId}] 🔍 Loaded ${chunks.length} chunks from subjects: ${querySubjects.join(', ')}`);
        }
      } catch (error) {
        console.error(`[${requestId}] ⚠️ Subject filter failed, loading all chunks:`, error);
        chunks = await loadAllChunks(); // Fallback to all chunks
      }
    } else {
      // Load all chunks (filesystem or no subject filter)
      chunks = await getDocumentChunks();
      console.log(`[${requestId}] 🔍 Loaded ${chunks.length} chunks (no subject filter)`);
    }
    const chunkLoadTime = Date.now() - chunkLoadStartTime;
    logCpuUsage(requestId, `Chunk Loading (${chunks.length} chunks, ${chunkLoadTime}ms)`, chunkLoadStartCpu);

    // Warn if no chunks available
    if (chunks.length === 0) {
      console.error(`[${requestId}] ❌ CRITICAL: No chunks loaded! Database might be empty or connection failed.`);
      return NextResponse.json(
        { 
          error: 'No documents available. Please check database connection and ensure documents are migrated.',
          details: 'The database appears to be empty or not connected. Visit /admin/migrate to upload documents.'
        },
        { status: 503 }
      );
    }

    // Step 4: Generate response using selected AI provider with RAG (using expanded query)
    const ragStartCpu = process.cpuUsage();
    const ragStartTime = Date.now();
    const response = await generateChatResponse(message, chunks, requestId, provider, expandedQuery);
    const ragTime = Date.now() - ragStartTime;
    logCpuUsage(requestId, `RAG + AI Response (${ragTime}ms)`, ragStartCpu);
    
    // Final summary
    const totalTime = Date.now() - requestStartTime;
    logCpuUsage(requestId, `Total Request (${totalTime}ms)`, requestStartCpu);
    console.log(`[${requestId}] ✅ Request completed in ${totalTime}ms`);
    console.log(`${'='.repeat(80)}\n`);

    return NextResponse.json({ response, provider });
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

// Optional: Add GET endpoint to refresh document cache (used for preloading)
export async function GET() {
  try {
    // Use the same getDocumentChunks function to ensure we load from database if available
    const chunks = await getDocumentChunks();
    return NextResponse.json({ 
      message: 'Documents preloaded successfully',
      chunksCount: chunks.length 
    });
  } catch (error) {
    console.error('GET /api/chat error:', error);
    return NextResponse.json(
      { error: 'Failed to preload documents', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



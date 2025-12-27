/**
 * Embeddings utility for semantic search using Gemini
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIMENSIONS = 768;
const BATCH_SIZE = 10;

let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });
  
  // Truncate text if too long (Gemini has a limit)
  const truncatedText = text.slice(0, 25000);
  
  const result = await model.embedContent(truncatedText);
  return result.embedding.values;
}

/**
 * Generate embeddings for multiple texts in batches
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = await Promise.all(
      batch.map(text => generateEmbedding(text))
    );
    embeddings.push(...batchEmbeddings);
  }
  
  return embeddings;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    console.warn(`Vector length mismatch: ${vec1.length} vs ${vec2.length}`);
    return 0;
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (magnitude === 0) return 0;
  
  return dotProduct / magnitude;
}

/**
 * Normalize cosine similarity score from [-1, 1] to [0, 1]
 */
export function normalizeScore(score: number): number {
  return (score + 1) / 2;
}

// Cache for query embeddings (avoid regenerating for same query)
const queryEmbeddingCache = new Map<string, number[]>();
const QUERY_CACHE_MAX_SIZE = 100;

/**
 * Get embedding for a query (with caching)
 */
export async function getQueryEmbedding(query: string): Promise<number[]> {
  const cacheKey = query.toLowerCase().trim();
  
  if (queryEmbeddingCache.has(cacheKey)) {
    return queryEmbeddingCache.get(cacheKey)!;
  }
  
  const embedding = await generateEmbedding(query);
  
  // Manage cache size
  if (queryEmbeddingCache.size >= QUERY_CACHE_MAX_SIZE) {
    const firstKey = queryEmbeddingCache.keys().next().value;
    if (firstKey) queryEmbeddingCache.delete(firstKey);
  }
  
  queryEmbeddingCache.set(cacheKey, embedding);
  return embedding;
}

/**
 * Find top K most similar chunks using embeddings
 */
export function findTopKSimilar(
  queryEmbedding: number[],
  chunks: Array<{ embedding: number[]; [key: string]: any }>,
  k: number = 5
): Array<{ chunk: any; similarity: number }> {
  const scored = chunks
    .filter(chunk => chunk.embedding && chunk.embedding.length > 0)
    .map(chunk => ({
      chunk,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity);
  
  return scored.slice(0, k);
}


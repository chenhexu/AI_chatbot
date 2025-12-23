import OpenAI from 'openai';

// Embedding model configuration
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 100; // OpenAI allows up to 2048 inputs per batch

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();
  
  // Truncate text if too long (max ~8000 tokens for text-embedding-3-small)
  const truncatedText = text.slice(0, 30000); // ~8000 tokens roughly
  
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncatedText,
  });
  
  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 * More efficient than generating one at a time
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const client = getOpenAIClient();
  const results: number[][] = [];
  
  // Process in batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    
    // Truncate texts
    const truncatedBatch = batch.map(text => text.slice(0, 30000));
    
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: truncatedBatch,
    });
    
    // Extract embeddings in order
    const embeddings = response.data
      .sort((a, b) => a.index - b.index)
      .map(item => item.embedding);
    
    results.push(...embeddings);
  }
  
  return results;
}

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error(`Vector length mismatch: ${vec1.length} vs ${vec2.length}`);
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
  
  if (magnitude === 0) {
    return 0;
  }
  
  return dotProduct / magnitude;
}

/**
 * Normalize cosine similarity from [-1, 1] to [0, 1]
 */
export function normalizeScore(similarity: number): number {
  return (similarity + 1) / 2;
}

/**
 * Find top-k most similar embeddings
 */
export function findTopKSimilar(
  queryEmbedding: number[],
  embeddings: Array<{ id: string | number; embedding: number[] }>,
  k: number = 5
): Array<{ id: string | number; score: number }> {
  const scored = embeddings.map(item => ({
    id: item.id,
    score: cosineSimilarity(queryEmbedding, item.embedding),
  }));
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);
  
  return scored.slice(0, k);
}

// Cache for query embeddings to avoid regenerating
const queryEmbeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get embedding for a query (with caching)
 */
export async function getQueryEmbedding(query: string): Promise<number[]> {
  const cacheKey = query.toLowerCase().trim();
  const cached = queryEmbeddingCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.embedding;
  }
  
  const embedding = await generateEmbedding(query);
  
  queryEmbeddingCache.set(cacheKey, {
    embedding,
    timestamp: Date.now(),
  });
  
  // Clean up old cache entries
  if (queryEmbeddingCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of queryEmbeddingCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        queryEmbeddingCache.delete(key);
      }
    }
  }
  
  return embedding;
}

export { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS };


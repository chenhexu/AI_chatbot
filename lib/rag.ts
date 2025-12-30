// Lightweight RAG implementation - optimized for low-CPU servers (0.1 CPU on Render free tier)

export interface TextChunk {
  text: string;
  source: string;
  index: number;
  pdfUrl?: string;
}

/**
 * Split text into chunks with overlap
 */
export function chunkText(text: string, chunkSize: number = 1500, overlap: number = 300): string[] {
  const chunks: string[] = [];
  const sections = text.split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 0);
  
  if (sections.length === 0) {
    return [text.trim()];
  }
  
  let currentChunk = '';
  
  for (const section of sections) {
    const potentialChunk = currentChunk ? currentChunk + '\n\n' + section : section;
    
    if (potentialChunk.length > chunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = section;
    } else {
      currentChunk = potentialChunk;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.length > 0 ? chunks : [text.trim()];
}

/**
 * Calculate text similarity score - LIGHTWEIGHT VERSION
 * Optimized for low-CPU servers
 */
export function calculateSimilarity(query: string, text: string, source?: string): number {
  // Skip CSS/JS/garbage files entirely
  if (source) {
    const sourceLower = source.toLowerCase();
    if (sourceLower.includes('.css') || sourceLower.includes('.js') || 
        sourceLower.includes('.min.') || sourceLower.includes('stylesheet') ||
        sourceLower.includes('block-library') || sourceLower.includes('metaslider') ||
        sourceLower.includes('fontawesome') || sourceLower.includes('releases_v') ||
        sourceLower.includes('font-awesome')) {
      return 0;
    }
  }
  
  const textLower = text.toLowerCase();
  
  // Simple stop words
  const stopWords = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 
    'qui', 'que', 'the', 'is', 'are', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'at',
    'when', 'where', 'what', 'how', 'does', 'do', 'did', 'est', 'sont']);
  
  // Extract keywords from query
  const queryWords = query.toLowerCase()
    .replace(/[^\w\sàâäéèêëïîôùûüç-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  if (queryWords.length === 0) return 0;
  
  // Count keyword matches
  let matches = 0;
  for (const word of queryWords) {
    if (textLower.includes(word)) {
      matches++;
    }
  }
  
  return matches / queryWords.length;
}

/**
 * Find most relevant chunks for a query
 */
export function findRelevantChunks(
  chunks: TextChunk[],
  query: string,
  maxChunks: number = 5
): TextChunk[] {
  const queryWords = query.toLowerCase()
    .replace(/[^\w\sàâäéèêëïîôùûüç-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
  
  console.log(`🔎 RAG search with ${queryWords.length} keywords: ${queryWords.slice(0, 10).join(', ')}`);
  
  // Score all chunks
  const scoredChunks = chunks.map(chunk => ({
    chunk,
    score: calculateSimilarity(query, chunk.text, chunk.source),
  }));
  
  // Sort by score
  scoredChunks.sort((a, b) => b.score - a.score);
  
  console.log(`📊 Top scores: ${scoredChunks.slice(0, 3).map(s => s.score.toFixed(3)).join(', ')}`);
  
  // Return top chunks with score > 0
  const relevant = scoredChunks
    .filter(item => item.score > 0)
    .slice(0, maxChunks);
  
  if (relevant.length > 0) {
    return relevant.map(item => item.chunk);
  }
  
  // Fallback: return top 3 even with low scores
  return scoredChunks.slice(0, 3).map(item => item.chunk);
}

/**
 * Process documents into chunks
 */
export function processDocuments(documents: Array<{ id: string; content: string; pdfUrl?: string }>): TextChunk[] {
  const allChunks: TextChunk[] = [];
  
  for (const doc of documents) {
    const chunks = chunkText(doc.content);
    chunks.forEach((chunk, index) => {
      allChunks.push({
        text: chunk,
        source: doc.id,
        index,
        pdfUrl: doc.pdfUrl,
      });
    });
  }
  
  return allChunks;
}

/**
 * Build context string from relevant chunks
 */
export function buildContextString(chunks: TextChunk[]): string {
  if (chunks.length === 0) return '';
  
  // Limit each chunk to 8K chars
  const MAX_CHUNK_LENGTH = 8000;
  
  const pdfUrls = new Set<string>();
  chunks.forEach(chunk => {
    if (chunk.pdfUrl) pdfUrls.add(chunk.pdfUrl);
  });
  
  const contextParts = chunks.map((chunk, index) => {
    const chunkText = chunk.text.length > MAX_CHUNK_LENGTH
      ? chunk.text.substring(0, MAX_CHUNK_LENGTH) + '\n\n[Truncated...]'
      : chunk.text;
    let part = `[Context ${index + 1}]\n${chunkText}`;
    if (chunk.pdfUrl) part += `\n[Source: ${chunk.pdfUrl}]`;
    return part;
  });
  
  let context = contextParts.join('\n\n---\n\n');
  
  if (pdfUrls.size > 0) {
    context += '\n\n---\n\n[PDF Documents:]\n';
    Array.from(pdfUrls).forEach((url, idx) => {
      const fileName = url.replace('file://', '').split('/').pop() || url;
      context += `${idx + 1}. ${fileName} - /api/pdf/${fileName}\n`;
    });
  }
  
  return context;
}

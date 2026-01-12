import { getGeminiClient, getGeminiModel } from './openai';

/**
 * Expand a query using Gemini to generate synonyms and related terms
 * This improves RAG retrieval by finding chunks with similar meaning but different wording
 */
export async function expandQuery(query: string): Promise<string> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: getGeminiModel() });
  
  const prompt = `A user asked this question: "${query}"

Generate a search query that includes:
1. The original question
2. Key synonyms and related terms
3. Alternative phrasings that might appear in documents

Keep it concise (max 100 words). Return ONLY the expanded query, nothing else.

Example:
Input: "Quand commence l'école?"
Output: "Quand commence l'école début rentrée scolaire date début classes"`;

  try {
    const result = await model.generateContent(prompt);
    const expanded = result.response.text().trim();
    
    // Combine original query with expansion
    // Use original query first, then add expanded terms
    return `${query} ${expanded}`.trim();
  } catch (error) {
    console.error('Query expansion error:', error);
    // Fallback to original query if expansion fails
    return query;
  }
}

/**
 * Translate query to French using Gemini
 * This helps match queries with French documents
 */
export async function translateQueryToFrench(query: string): Promise<string> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: getGeminiModel() });
  
  // Simple heuristic: if query contains common English words, translate it
  const englishWords = ['the', 'is', 'are', 'who', 'what', 'where', 'when', 'why', 'how', 'can', 'will', 'principal', 'school', 'start', 'begin'];
  const hasEnglishWords = englishWords.some(word => query.toLowerCase().includes(word));
  
  if (!hasEnglishWords) {
    // Probably already in French or another language
    return query;
  }
  
  const prompt = `Translate this question to French. Only return the translation, nothing else.

Question: "${query}"
Translation:`;

  try {
    const result = await model.generateContent(prompt);
    const translation = result.response.text().trim();
    console.log(`Query translation: "${query}" -> "${translation}"`);
    return translation;
  } catch (error) {
    console.error('Query translation error:', error);
    // Return original query if translation fails
    return query;
  }
}

/**
 * Expand and translate query for better RAG retrieval
 * Returns the expanded query (original + synonyms + translated if needed)
 */
export async function expandAndTranslateQuery(query: string): Promise<string> {
  try {
    // First translate if needed
    const translated = await translateQueryToFrench(query);
    
    // If translation is different, use both original and translated
    if (translated !== query && translated.length > 0) {
      // Expand the translated version
      const expanded = await expandQuery(translated);
      // Combine original, translated, and expanded
      return `${query} ${translated} ${expanded}`.trim();
    } else {
      // Just expand the original query
      return await expandQuery(query);
    }
  } catch (error) {
    console.error('Query expansion/translation error:', error);
    return query;
  }
}


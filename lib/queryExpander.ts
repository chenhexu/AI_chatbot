import { getGeminiClient, getGeminiModel } from './openai';

/**
 * Expand a query using Gemini to generate synonyms and related terms
 * This improves RAG retrieval by finding chunks with similar meaning but different wording
 */
export async function expandQuery(query: string): Promise<string> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: getGeminiModel() });
  
  const prompt = `A user asked this question: "${query}"

Generate additional search terms that include:
1. Key synonyms and related terms
2. Alternative phrasings that might appear in documents
3. Related concepts and keywords

Return ONLY the additional search terms (not the original question), separated by spaces. Max 50 words.

Example:
Input: "Quand commence l'école?"
Output: "début rentrée scolaire date début classes ouverture"

Example:
Input: "Qui est le directeur?"
Output: "directeur principal administrateur chef direction"`;

  try {
    const modelName = getGeminiModel();
    console.log(`🤖 [AI CALL] Gemini (${modelName}) - Query Expansion`);
    console.log(`   Input: "${query}"`);
    
    const result = await model.generateContent(prompt);
    let expanded = result.response.text().trim();
    // Clean up any markdown or extra formatting
    expanded = expanded.replace(/^["']|["']$/g, '').trim();
    // Remove common prefixes
    expanded = expanded.replace(/^(output|terms|expansion)[:\s]+/i, '').trim();
    
    // Combine original query with expansion
    if (expanded && expanded.length > 0 && expanded !== query) {
      const finalExpanded = `${query} ${expanded}`.trim();
      console.log(`   Response: "${finalExpanded.substring(0, 150)}${finalExpanded.length > 150 ? '...' : ''}"`);
      return finalExpanded;
    }
    console.log(`   Response: (no expansion - using original)`);
    return query;
  } catch (error) {
    console.error('🤖 [AI CALL] Query expansion error:', error);
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
  const englishWords = ['the', 'is', 'are', 'who', 'what', 'where', 'when', 'why', 'how', 'can', 'will', 'principal', 'school', 'start', 'begin', 'does', 'did', 'has', 'have', 'was', 'were', 'code', 'life', 'opened', 'college', 'college', 'opened', 'portes', 'code', 'vie'];
  const queryLower = query.toLowerCase();
  const hasEnglishWords = englishWords.some(word => queryLower.includes(word));
  
  if (!hasEnglishWords) {
    // Probably already in French or another language - but try translation anyway if it looks like English
    if (/^[a-z\s?]+$/i.test(query) && query.length < 100) {
      // Looks like English-only text, try translating
    } else {
      return query;
    }
  }
  
  const prompt = `Translate this question to French. Return ONLY the French translation, nothing else. Do not include explanations, punctuation, or extra text.

Question: "${query}"
French translation:`;

  try {
    const modelName = getGeminiModel();
    console.log(`🤖 [AI CALL] Gemini (${modelName}) - Query Translation`);
    console.log(`   Input: "${query}"`);
    
    const result = await model.generateContent(prompt);
    let translation = result.response.text().trim();
    // Clean up any markdown or extra formatting
    translation = translation.replace(/^["']|["']$/g, '').trim();
    // Remove common prefixes like "Translation:" or "Réponse:"
    translation = translation.replace(/^(translation|réponse|traduction)[:\s]+/i, '').trim();
    
    if (translation && translation.length > 0 && translation !== query) {
      console.log(`   Response: "${translation}"`);
      console.log(`Query translation: "${query}" -> "${translation}"`);
      return translation;
    }
    console.log(`   Response: (no translation - using original)`);
    return query;
  } catch (error) {
    console.error('🤖 [AI CALL] Query translation error:', error);
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
    
    // If translation is different, use both original and translated, then expand
    if (translated !== query && translated.length > 0) {
      // Expand the translated version (which already includes translated + terms)
      const expandedTranslated = await expandQuery(translated);
      // Combine original with expanded translated query
      // expandedTranslated is already "translated + expansion terms"
      // So we just prepend the original query
      return `${query} ${expandedTranslated}`.trim();
    } else {
      // Just expand the original query
      return await expandQuery(query);
    }
  } catch (error) {
    console.error('Query expansion/translation error:', error);
    return query;
  }
}


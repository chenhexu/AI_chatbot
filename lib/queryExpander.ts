import { getGeminiClient, getGeminiModel, getGLMClient, getGLMModel } from './openai';

/**
 * Expand a query using AI to generate synonyms and related terms
 * This improves RAG retrieval by finding chunks with similar meaning but different wording
 * @param backgroundAI - AI model to use ('gemini' or 'glm')
 */
export async function expandQuery(query: string, backgroundAI: 'gemini' | 'glm' = 'gemini'): Promise<string> {
  
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
    if (backgroundAI === 'glm') {
      // Use GLM-4.7
      const client = getGLMClient();
      const modelName = getGLMModel();
      console.log(`🤖 [AI CALL] GLM-4.7 (${modelName}) - Query Expansion`);
      console.log(`   Input: "${query}"`);
      
      const response = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: 'You are a query expansion assistant. Return only additional search terms, nothing else.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 100,
      });
      
      let expanded = response.choices[0]?.message?.content?.trim() || '';
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
    } else {
      // Use Gemini
      const client = getGeminiClient();
      const model = client.getGenerativeModel({ model: getGeminiModel() });
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
    }
  } catch (error) {
    console.error('🤖 [AI CALL] Query expansion error:', error);
    
    // If GLM failed, try Gemini as fallback
    if (backgroundAI === 'glm') {
      try {
        console.log(`🔄 Trying Gemini as fallback for query expansion...`);
        const geminiClient = getGeminiClient();
        const geminiModel = geminiClient.getGenerativeModel({ model: getGeminiModel() });
        const result = await geminiModel.generateContent(prompt);
        let expanded = result.response.text().trim();
        expanded = expanded.replace(/^["']|["']$/g, '').trim();
        expanded = expanded.replace(/^(output|terms|expansion)[:\s]+/i, '').trim();
        if (expanded && expanded.length > 0 && expanded !== query) {
          return `${query} ${expanded}`.trim();
        }
      } catch (fallbackError) {
        console.log(`⚠️ Gemini fallback also failed for query expansion`);
      }
    }
    
    // Fallback to original query if expansion fails
    return query;
  }
}

/**
 * Translate query to French using AI
 * This helps match queries with French documents
 * @param backgroundAI - AI model to use ('gemini' or 'glm')
 */
export async function translateQueryToFrench(query: string, backgroundAI: 'gemini' | 'glm' = 'gemini'): Promise<string> {
  
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
    if (backgroundAI === 'glm') {
      // Use GLM-4.7
      const client = getGLMClient();
      const modelName = getGLMModel();
      console.log(`🤖 [AI CALL] GLM-4.7 (${modelName}) - Query Translation`);
      console.log(`   Input: "${query}"`);
      
      const response = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: 'You are a translator. Translate the question to French. Return only the translation, nothing else.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 100,
      });
      
      let translation = response.choices[0]?.message?.content?.trim() || '';
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
    } else {
      // Use Gemini
      const client = getGeminiClient();
      const model = client.getGenerativeModel({ model: getGeminiModel() });
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
    }
  } catch (error) {
    console.error('🤖 [AI CALL] Query translation error:', error);
    
    // If GLM failed, try Gemini as fallback
    if (backgroundAI === 'glm') {
      try {
        console.log(`🔄 Trying Gemini as fallback for query translation...`);
        const geminiClient = getGeminiClient();
        const geminiModel = geminiClient.getGenerativeModel({ model: getGeminiModel() });
        const result = await geminiModel.generateContent(prompt);
        let translation = result.response.text().trim();
        translation = translation.replace(/^["']|["']$/g, '').trim();
        translation = translation.replace(/^(translation|réponse|traduction)[:\s]+/i, '').trim();
        if (translation && translation.length > 0 && translation !== query) {
          return translation;
        }
      } catch (fallbackError) {
        console.log(`⚠️ Gemini fallback also failed for query translation`);
      }
    }
    
    // Return original query if translation fails
    return query;
  }
}

/**
 * Generate multiple query variations for better retrieval
 * Returns array of query variations (original + rephrased versions)
 */
export async function generateQueryVariations(query: string, backgroundAI: 'gemini' | 'glm' = 'glm'): Promise<string[]> {
  const variations: string[] = [query]; // Always include original
  
  try {
    const prompt = `Generate 2 alternative phrasings of this question that might appear in documents. Return ONLY the 2 phrasings, one per line, nothing else.

Original: "${query}"

Alternative phrasings:`;

    if (backgroundAI === 'glm') {
      const client = getGLMClient();
      const modelName = getGLMModel();
      const response = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: 'You are a query rephrasing assistant. Return only 2 alternative phrasings, one per line.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 100,
      });
      
      const text = response.choices[0]?.message?.content?.trim() || '';
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && l !== query);
      variations.push(...lines.slice(0, 2));
    } else {
      const client = getGeminiClient();
      const model = client.getGenerativeModel({ model: getGeminiModel() });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && l !== query);
      variations.push(...lines.slice(0, 2));
    }
  } catch (error) {
    console.warn('Query variation generation failed, using original only:', error);
  }
  
  return variations.filter((v, i, arr) => arr.indexOf(v) === i); // Deduplicate
}

/**
 * Expand and translate query for better RAG retrieval
 * ENHANCED: Now generates multiple query variations for better retrieval
 * Returns the expanded query (original + synonyms + translated if needed + variations)
 * @param backgroundAI - AI model to use for background processing ('gemini' or 'glm')
 */
export async function expandAndTranslateQuery(query: string, backgroundAI: 'gemini' | 'glm' = 'gemini'): Promise<string> {
  try {
    // First translate if needed
    const translated = await translateQueryToFrench(query, backgroundAI);
    
    // Generate query variations
    const variations = await generateQueryVariations(query, backgroundAI);
    
    // If translation is different, use both original and translated, then expand
    if (translated !== query && translated.length > 0) {
      // Expand the translated version (which already includes translated + terms)
      const expandedTranslated = await expandQuery(translated, backgroundAI);
      // Combine original with expanded translated query and variations
      const allTerms = [query, expandedTranslated, ...variations].filter((v, i, arr) => arr.indexOf(v) === i);
      return allTerms.join(' ').trim();
    } else {
      // Just expand the original query and add variations
      const expanded = await expandQuery(query, backgroundAI);
      const allTerms = [expanded, ...variations].filter((v, i, arr) => arr.indexOf(v) === i);
      return allTerms.join(' ').trim();
    }
  } catch (error) {
    console.error('Query expansion/translation error:', error);
    return query;
  }
}


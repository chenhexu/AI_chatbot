import { GoogleGenerativeAI } from '@google/generative-ai';

// Expansion cache to avoid repeated API calls
const expansionCache = new Map<string, string>();

// Gemini client singleton
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

const EXPANSION_PROMPT = `You are a query expansion assistant for a French school's FAQ chatbot.

Given a user question (in English or French), output ONLY a space-separated list of French keywords and synonyms that would help find relevant documents.

Rules:
- Output ONLY keywords, no sentences, no punctuation except hyphens
- Include French translations of all concepts
- Include synonyms and related terms
- Include common variations (directeur/directrice, ouvert/ouverte)
- Include the original query words too
- Keep it under 40 words
- Focus on nouns and verbs that are likely in documents

Examples:
Input: "when did the school open?"
Output: école ouvert portes année ouverture fondation création établissement début collège ouvrir 1988 histoire

Input: "who is the principal?"
Output: directeur directrice direction principal école responsable chef établissement mot direction

Input: "what activities are available?"
Output: activités activité parascolaire midi robotique théâtre sport club vie étudiante loisirs

Input: "when is the school open?"
Output: horaire école ouvert ouverte heures fermeture calendrier jour semaine heure ouverture`;

/**
 * Expand a user query into French keywords using Gemini Flash
 * Returns both original query + expanded keywords for broader matching
 * Has a 5-second timeout to prevent blocking
 */
export async function expandQuery(query: string): Promise<string> {
  const cacheKey = query.toLowerCase().trim();
  
  // Check cache first
  if (expansionCache.has(cacheKey)) {
    console.log('📦 Query expansion from cache');
    return expansionCache.get(cacheKey)!;
  }
  
  try {
    console.log('🧠 Calling Gemini Flash for query expansion...');
    const startTime = Date.now();
    
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Create promise with timeout
    const expansionPromise = model.generateContent({
      contents: [{ role: 'user', parts: [{ text: `${EXPANSION_PROMPT}\n\nInput: "${query}"\nOutput:` }] }],
      generationConfig: {
        maxOutputTokens: 100,
        temperature: 0.3, // Low temperature for consistent output
      },
    });
    
    // 5 second timeout
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Gemini timeout after 5s')), 5000)
    );
    
    const result = await Promise.race([expansionPromise, timeoutPromise]);
    
    const expanded = result.response.text().trim();
    const duration = Date.now() - startTime;
    
    console.log(`✅ Query expansion (${duration}ms): "${query}" -> "${expanded}"`);
    
    // Combine original query with expanded keywords
    const combined = `${query} ${expanded}`;
    
    // Cache the result
    expansionCache.set(cacheKey, combined);
    
    return combined;
  } catch (error) {
    console.error('❌ Gemini expansion failed:', error instanceof Error ? error.message : 'Unknown error');
    // Fallback: return original query
    return query;
  }
}


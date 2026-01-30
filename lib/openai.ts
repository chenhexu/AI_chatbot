import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { findRelevantChunks, buildContextString, type TextChunk } from './rag';
import { detectLanguage, getLanguageMessages } from './utils/filters';

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

// Initialize Gemini client
let geminiClient: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
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
 * Get Gemini model name from environment variable, with fallback
 */
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
}

/**
 * Translate query to French for better matching with French documents
 * Uses free Google Translate API (no API key needed) or OpenAI if preferred
 */
export async function translateQueryToFrench(query: string, client: OpenAI): Promise<string> {
  try {
    // Simple heuristic: if query contains common English words, translate it
    const englishWords = ['the', 'is', 'are', 'who', 'what', 'where', 'when', 'why', 'how', 'can', 'will', 'principal', 'school'];
    const hasEnglishWords = englishWords.some(word => query.toLowerCase().includes(word));
    
    if (!hasEnglishWords) {
      // Probably already in French or another language
      return query;
    }
    
    // Skip Google Translate - it's unreliable and slow. Use OpenAI directly for faster, more reliable translation.
    // Google Translate often times out on Render and adds unnecessary delay.
    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini', // Use a cheaper model for translation
        messages: [
          {
            role: 'system',
            content: 'You are a translator. Translate the user\'s question to French. Only return the translation, nothing else.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.3,
        max_tokens: 100,
      });
      
      const translation = response.choices[0]?.message?.content?.trim() || query;
      console.log(`✅ Translation success: "${query}" -> "${translation}"`);
      return translation;
    } catch (openaiError) {
      console.error('❌ Translation failed:', openaiError instanceof Error ? openaiError.message : String(openaiError));
      // Return original query if translation fails
      return query;
    }
  } catch (error) {
    console.warn('Translation failed, using original query:', error);
    return query;
  }
}

/**
 * Generate chat response using OpenAI or Gemini with RAG context
 */
export async function generateChatResponse(
  userMessage: string,
  documentChunks: TextChunk[],
  requestId?: string,
  provider: 'openai' | 'gemini' = 'openai',
  expandedQuery?: string
): Promise<string> {
  const logPrefix = requestId ? `[${requestId}]` : '';
  
  // Use Gemini if specified
  if (provider === 'gemini') {
    return generateGeminiChatResponse(userMessage, documentChunks, requestId, expandedQuery);
  }
  
  const client = getOpenAIClient();
  // Use gpt-4o-mini as the default model (fast and cheap)
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  
  // Find relevant chunks using expanded query if provided
  const searchQuery = expandedQuery || userMessage;
  console.log(`${logPrefix} 🔎 Finding relevant chunks...`);
  const uniqueChunks = findRelevantChunks(documentChunks, searchQuery, 5);
  const context = buildContextString(uniqueChunks);
  console.log(`${logPrefix} ✅ Found ${uniqueChunks.length} chunks`);
  
  // Limit context size to avoid token limit errors
  // Rough estimate: 1 token ≈ 4 characters, so 400K tokens ≈ 1.6M characters
  // Leave room for prompt and response, so limit context to ~1M characters
  const MAX_CONTEXT_LENGTH = 1000000; // ~250K tokens
  const truncatedContext = context.length > MAX_CONTEXT_LENGTH 
    ? context.substring(0, MAX_CONTEXT_LENGTH) + '\n\n[Context truncated due to size limit...]'
    : context;
  
  // Log for debugging (remove in production if desired)
  console.log(`${logPrefix} Query: "${userMessage}" - Found ${uniqueChunks.length} relevant chunks out of ${documentChunks.length} total chunks`);
  if (uniqueChunks.length > 0) {
    console.log(`${logPrefix} Top chunk sources: ${uniqueChunks.slice(0, 3).map(c => c.source.split('/').pop()).join(', ')}`);
    // Log preview of top chunks to see what context is being used
    uniqueChunks.slice(0, 2).forEach((chunk, i) => {
      const preview = chunk.text.substring(0, 200).replace(/\n/g, ' ');
      console.log(`${logPrefix}   Chunk ${i + 1} preview: ${preview}...`);
    });
  } else {
    console.warn(`${logPrefix} ⚠️  No relevant chunks found! This might cause the AI to say it doesn't have information.`);
  }
  
  // Extract PDF links from relevant chunks
  const pdfLinks = new Set<string>();
  uniqueChunks.forEach(chunk => {
    if (chunk.pdfUrl) {
      pdfLinks.add(chunk.pdfUrl);
    }
  });
  
  // Detect language from user message (using shared utility)
  const detectedLanguage = detectLanguage(userMessage);
  const isEnglish = detectedLanguage === 'en';
  
  // Get language-specific messages (using shared utility)
  const langMessages = getLanguageMessages(detectedLanguage);
  const errorMessage = langMessages.noInfo;
  const defaultErrorMessage = langMessages.defaultError;
  const languageInstruction = langMessages.languageInstruction;
  
  const systemPrompt = `You are a helpful AI assistant for Collège Saint-Louis, a French secondary school in Quebec, Canada. 
Your role is to answer questions about the school based on the information provided to you.

IMPORTANT RULES:
- Answer questions based on the context information provided below
- If the information is clearly not in the provided context, say: "${errorMessage}"
- ${languageInstruction}
- Be helpful, friendly, and professional
- Try to infer reasonable answers from the context even if not explicitly stated
- For questions about staff/personnel/director/principal, look for names, roles, and titles in the context
- For questions about recipes/ingredients, extract the complete ingredient list and preparation steps from the context
- For questions about the school, use any relevant information from the context
- When answering recipe questions, provide complete and accurate information including all ingredients with measurements
- **IMPORTANT**: When users ask for PDF links or download links, you MUST provide the PDF download links in a clear, natural format. ${isEnglish 
    ? 'For each PDF, format your response like: "You can download the PDF document by following this link: /api/pdf/[filename]".' 
    : 'Pour chaque PDF, formatez votre réponse comme suit: "Vous pouvez télécharger le document PDF en suivant ce lien: /api/pdf/[nom du fichier PDF]".'} Use the exact filename from the "[PDF Documents disponibles:]" section (just the filename, no brackets or extra formatting). If multiple PDFs are available, list them clearly with separate links for each. Always include the full path /api/pdf/ followed by the exact filename.

Context information about Collège Saint-Louis:
${truncatedContext || (isEnglish ? 'No specific context available. Please inform the user that you need more information.' : 'Aucun contexte spécifique disponible. Veuillez informer l\'utilisateur que vous avez besoin de plus d\'informations.')}`;

  // Build user message - use the original message directly (no French prefix)
  const userPrompt = userMessage;

  try {
    console.log(`${logPrefix} 🤖 [AI CALL] OpenAI (${model}) - Chat Response Generation`);
    console.log(`${logPrefix}    User message: "${userMessage.substring(0, 150)}${userMessage.length > 150 ? '...' : ''}"`);
    console.log(`${logPrefix}    Context chunks: ${uniqueChunks.length}, Context length: ${truncatedContext.length} chars`);
    
    // Add timeout to prevent Render from killing the request
    const timeoutMs = 25000; // 25 seconds (Render has 30s limit)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await client.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 400, // Reduced for faster response
      });
      
      clearTimeout(timeoutId);
      const answer = response.choices[0]?.message?.content || defaultErrorMessage;
      console.log(`${logPrefix}    Response: "${answer.substring(0, 150)}${answer.length > 150 ? '...' : ''}" (${answer.length} chars)`);
      console.log(`${logPrefix} ✅ Response received (${answer.length} chars)`);
      return answer;
    } catch (apiError: unknown) {
      clearTimeout(timeoutId);
      if (apiError instanceof Error && apiError.name === 'AbortError') {
        console.error(`${logPrefix} ⏱️ OpenAI request timed out after ${timeoutMs}ms`);
        return langMessages.timeout;
      }
      throw apiError;
    }
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error(
      `Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate chat response using Google Gemini with RAG context
 */
async function generateGeminiChatResponse(
  userMessage: string,
  documentChunks: TextChunk[],
  requestId?: string,
  expandedQuery?: string
): Promise<string> {
  const logPrefix = requestId ? `[${requestId}]` : '';
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: getGeminiModel() });
  
  // Find relevant chunks using expanded query if provided
  const searchQuery = expandedQuery || userMessage;
  const relevantChunks = findRelevantChunks(documentChunks, searchQuery, 6);
  const context = buildContextString(relevantChunks);
  
  // Limit context size
  const MAX_CONTEXT_LENGTH = 500000;
  const truncatedContext = context.length > MAX_CONTEXT_LENGTH 
    ? context.substring(0, MAX_CONTEXT_LENGTH) + '\n\n[Context truncated...]'
    : context;
  
  console.log(`${logPrefix} Query: "${userMessage}" - Found ${relevantChunks.length} relevant chunks (Gemini)`);
  
  // Detect language (using shared utility)
  const detectedLanguage = detectLanguage(userMessage);
  const isEnglish = detectedLanguage === 'en';
  const langMessages = getLanguageMessages(detectedLanguage);
  const errorMessage = langMessages.noInfo;
  const languageInstruction = isEnglish 
    ? 'Respond in ENGLISH only.'
    : 'Répondez en FRANÇAIS uniquement.';
  
  const prompt = `You are a helpful AI assistant for Collège Saint-Louis, a French secondary school in Quebec, Canada.

RULES:
- Answer based on the context information below
- If information is not in context, say: "${errorMessage}"
- ${languageInstruction}
- Be helpful, friendly, and professional

Context information:
${truncatedContext || 'No context available.'}

User question: ${userMessage}

Answer:`;

  try {
    const modelName = getGeminiModel();
    console.log(`${logPrefix} 🤖 [AI CALL] Gemini (${modelName}) - Chat Response Generation`);
    console.log(`${logPrefix}    User message: "${userMessage.substring(0, 150)}${userMessage.length > 150 ? '...' : ''}"`);
    console.log(`${logPrefix}    Context chunks: ${relevantChunks.length}, Context length: ${truncatedContext.length} chars`);
    
    // Add timeout
    const timeoutMs = 25000;
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Gemini timeout')), timeoutMs)
    );
    
    const result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise
    ]);
    
    const answer = result.response.text();
    console.log(`${logPrefix}    Response: "${answer.substring(0, 150)}${answer.length > 150 ? '...' : ''}" (${answer.length} chars)`);
    console.log(`${logPrefix} ✅ Gemini response received (${answer.length} chars)`);
    return answer;
  } catch (error) {
    if (error instanceof Error && error.message === 'Gemini timeout') {
      console.error(`${logPrefix} ⏱️ Gemini request timed out`);
      const detectedLanguage = detectLanguage(userMessage);
      return getLanguageMessages(detectedLanguage).timeout;
    }
    console.error('Gemini API error:', error);
    throw new Error(
      `Failed to generate Gemini response: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}



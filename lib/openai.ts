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
 * Default to gemini-2.5-flash (has availability) instead of flash-lite (exhausted)
 */
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

/**
 * Get alternative Gemini models for fallback (in order of preference)
 * Note: Gemma models may not be available through Gemini API - using confirmed available models
 */
export function getGeminiFallbackModels(): string[] {
  return [
    'gemini-2.5-flash',      // 2/5 RPM available
    'gemini-3-flash',        // 0/5 RPM - fully available
    'gemini-2.5-flash-lite' // Last resort (exhausted, but might work sometimes)
  ];
}

/**
 * Check if a model supports parallel requests (models with high RPM limits)
 */
export function supportsParallelRequests(modelName: string): boolean {
  // Only use parallel requests for models we know support it and have high limits
  // Gemma models are not available through Gemini API, so we'll skip them
  return false; // Disable parallel requests until we confirm model availability
}

// Initialize GLM-4.7 client (OpenAI-compatible API)
let glmClient: OpenAI | null = null;

/**
 * Get GLM-4.7 client (OpenAI-compatible API from BigModel.cn)
 */
export function getGLMClient(): OpenAI {
  if (!glmClient) {
    const apiKey = process.env.GLM_API_KEY || '9e4e9eb44cd54880abff2dbb1d96b6d2.cr8UJBSdL03lHRxX';
    const baseURL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/coding/paas/v4';
    glmClient = new OpenAI({
      apiKey,
      baseURL,
    });
  }
  return glmClient;
}

/**
 * Get GLM model name
 */
export function getGLMModel(): string {
  return process.env.GLM_MODEL || 'GLM-4.7';
}

// Initialize Ollama client (OpenAI-compatible local API)
let ollamaClient: OpenAI | null = null;

/**
 * Get Ollama client (OpenAI-compatible local API)
 * Ollama runs locally at http://localhost:11434 by default
 */
export function getOllamaClient(): OpenAI {
  if (!ollamaClient) {
    const baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
    // Ollama doesn't require an API key, but OpenAI client needs one
    ollamaClient = new OpenAI({
      apiKey: process.env.OLLAMA_API_KEY || 'ollama', // Not used, but required by OpenAI client
      baseURL,
    });
  }
  return ollamaClient;
}

/**
 * Get Ollama model name
 * Default to gemma3:12b if available, or check OLLAMA_MODEL env var
 */
export function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL || 'gemma3:12b';
}

/**
 * Check if Ollama is available (server is running)
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const client = getOllamaClient();
    // Try to list models to check if Ollama is running
    const response = await fetch(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
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
  provider: 'openai' | 'gemini' | 'glm' | 'ollama' = 'openai',
  expandedQuery?: string,
  querySubjects?: string[]
): Promise<string> {
  const logPrefix = requestId ? `[${requestId}]` : '';
  
  // Use Gemini if specified
  if (provider === 'gemini') {
    return generateGeminiChatResponse(userMessage, documentChunks, requestId, expandedQuery, querySubjects);
  }
  
  // Use GLM-4.7 if specified (OpenAI-compatible API)
  if (provider === 'glm') {
    return generateGLMChatResponse(userMessage, documentChunks, requestId, expandedQuery, querySubjects);
  }
  
  // Use Ollama if specified (self-hosted, OpenAI-compatible API)
  if (provider === 'ollama') {
    return generateOllamaChatResponse(userMessage, documentChunks, requestId, expandedQuery, querySubjects);
  }
  
  const client = getOpenAIClient();
  // Use gpt-4o-mini as the default model (fast and cheap)
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  
  // Find relevant chunks using expanded query if provided
  const searchQuery = expandedQuery || userMessage;
  console.log(`${logPrefix} 🔎 Finding relevant chunks...`);
  const uniqueChunks = findRelevantChunks(documentChunks, searchQuery, 5, querySubjects);
  
  // Extract PDF links from relevant chunks (do this before logging)
  const pdfLinks = new Set<string>();
  uniqueChunks.forEach(chunk => {
    if (chunk.pdfUrl) {
      pdfLinks.add(chunk.pdfUrl);
    }
  });
  
  const context = buildContextString(uniqueChunks, searchQuery);
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
    // Also log if any chunks contain "info-parents" for debugging
    const infoParentsChunks = uniqueChunks.filter(c => 
      c.text.toLowerCase().includes('info-parents') || 
      c.source.toLowerCase().includes('info-parents')
    );
    if (infoParentsChunks.length > 0) {
      console.log(`${logPrefix} ✅ Found ${infoParentsChunks.length} chunks containing "info-parents"`);
    } else {
      console.log(`${logPrefix} ⚠️ No chunks containing "info-parents" found in top results`);
    }
    uniqueChunks.slice(0, 2).forEach((chunk, i) => {
      const preview = chunk.text.substring(0, 200).replace(/\n/g, ' ');
      console.log(`${logPrefix}   Chunk ${i + 1} preview: ${preview}...`);
    });
    
    // Log PDF links found
    if (pdfLinks.size > 0) {
      console.log(`${logPrefix} 📄 PDF links found in context: ${Array.from(pdfLinks).slice(0, 3).join(', ')}`);
    } else {
      console.log(`${logPrefix} ⚠️ No PDF links found in selected chunks`);
    }
  } else {
    console.warn(`${logPrefix} ⚠️  No relevant chunks found! This might cause the AI to say it doesn't have information.`);
  }
  
  // Log context size and preview
  console.log(`${logPrefix} 📊 Context size: ${truncatedContext.length} characters (${Math.round(truncatedContext.length / 4)} estimated tokens)`);
  if (truncatedContext.length < 100) {
    console.warn(`${logPrefix} ⚠️ WARNING: Context is very short (${truncatedContext.length} chars), AI may not have enough information!`);
  }
  if (truncatedContext.length > MAX_CONTEXT_LENGTH * 0.9) {
    console.log(`${logPrefix} ⚠️ Context was truncated (exceeded ${MAX_CONTEXT_LENGTH} chars)`);
  }
  
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

SPECIAL INSTRUCTIONS FOR INFO-PARENTS QUERIES:
- "Info-parents" (or "info parents", "infos-parents") are parent communication documents/newsletters
- When users ask about "info-parents" documents, look for content containing "info-parents", "info parents", or "infos-parents" in the context
- These documents typically contain announcements, important dates, school news, and information for parents
- If a user asks for a specific month/year (e.g., "info-parents of January 2024"), look for documents that mention both the month and year
- When summarizing info-parents documents, provide key information, important dates, and announcements
- Always include PDF download links when available in the context (format: /api/pdf/[filename])
- **IMPORTANT**: When users ask for PDF links or download links, you MUST provide the PDF download links in a clear, natural format. ${isEnglish 
    ? 'For each PDF, format your response like: "You can download the PDF document by following this link: /api/pdf/[filename]".' 
    : 'Pour chaque PDF, formatez votre réponse comme suit: "Vous pouvez télécharger le document PDF en suivant ce lien: /api/pdf/[nom du fichier PDF]".'} 
  CRITICAL LINK FORMATTING RULES:
  - Use the EXACT filename from the "[PDF Documents disponibles:]" section (copy it exactly, including the .pdf extension)
  - Format links as: /api/pdf/[exact-filename-from-list]
  - Do NOT add brackets, quotes, or any extra formatting around the filename
  - Do NOT modify the filename (keep spaces, hyphens, and special characters as shown)
  - If multiple PDFs are available, list them clearly with separate links for each
  - Example: If the list shows "info-parents-janvier-2024.pdf", use exactly: /api/pdf/info-parents-janvier-2024.pdf

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
 * Generate chat response using GLM-4.7 with RAG context (OpenAI-compatible API)
 */
async function generateGLMChatResponse(
  userMessage: string,
  documentChunks: TextChunk[],
  requestId?: string,
  expandedQuery?: string,
  querySubjects?: string[]
): Promise<string> {
  const logPrefix = requestId ? `[${requestId}]` : '';
  
  const client = getGLMClient();
  const model = getGLMModel();
  
  // Find relevant chunks using expanded query if provided
  const searchQuery = expandedQuery || userMessage;
  console.log(`${logPrefix} 🔎 Finding relevant chunks...`);
  const uniqueChunks = findRelevantChunks(documentChunks, searchQuery, 6, querySubjects);
  
  // Extract PDF links from relevant chunks (do this before logging)
  const pdfLinks = new Set<string>();
  uniqueChunks.forEach(chunk => {
    if (chunk.pdfUrl) {
      pdfLinks.add(chunk.pdfUrl);
    }
  });
  
  const context = buildContextString(uniqueChunks, searchQuery);
  console.log(`${logPrefix} ✅ Found ${uniqueChunks.length} chunks`);
  
  // Limit context size
  const MAX_CONTEXT_LENGTH = 1000000; // 1M characters
  const truncatedContext = context.length > MAX_CONTEXT_LENGTH 
    ? context.substring(0, MAX_CONTEXT_LENGTH) + '\n\n[Context truncated due to size limit...]'
    : context;
  
  // Detect language
  const detectedLanguage = detectLanguage(userMessage);
  const isEnglish = detectedLanguage === 'en';
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

SPECIAL INSTRUCTIONS FOR INFO-PARENTS QUERIES:
- "Info-parents" (or "info parents", "infos-parents") are parent communication documents/newsletters
- When users ask about "info-parents" documents, look for content containing "info-parents", "info parents", or "infos-parents" in the context
- These documents typically contain announcements, important dates, school news, and information for parents
- If a user asks for a specific month/year (e.g., "info-parents of January 2024"), look for documents that mention both the month and year
- When summarizing info-parents documents, provide key information, important dates, and announcements
- Always include PDF download links when available in the context (format: /api/pdf/[filename])
- **IMPORTANT**: When users ask for PDF links or download links, you MUST provide the PDF download links in a clear, natural format. ${isEnglish 
    ? 'For each PDF, format your response like: "You can download the PDF document by following this link: /api/pdf/[filename]".' 
    : 'Pour chaque PDF, formatez votre réponse comme suit: "Vous pouvez télécharger le document PDF en suivant ce lien: /api/pdf/[nom du fichier PDF]".'} 
  CRITICAL LINK FORMATTING RULES:
  - Use the EXACT filename from the "[PDF Documents disponibles:]" section (copy it exactly, including the .pdf extension)
  - Format links as: /api/pdf/[exact-filename-from-list]
  - Do NOT add brackets, quotes, or any extra formatting around the filename
  - Do NOT modify the filename (keep spaces, hyphens, and special characters as shown)
  - If multiple PDFs are available, list them clearly with separate links for each
  - Example: If the list shows "info-parents-janvier-2024.pdf", use exactly: /api/pdf/info-parents-janvier-2024.pdf

Context information about Collège Saint-Louis:
${truncatedContext || (isEnglish ? 'No specific context available. Please inform the user that you need more information.' : 'Aucun contexte spécifique disponible. Veuillez informer l\'utilisateur que vous avez besoin de plus d\'informations.')}`;

  const userPrompt = userMessage;

  try {
    console.log(`${logPrefix} 🤖 [AI CALL] GLM-4.7 (${model}) - Chat Response Generation`);
    console.log(`${logPrefix}    User message: "${userMessage.substring(0, 150)}${userMessage.length > 150 ? '...' : ''}"`);
    console.log(`${logPrefix}    Context chunks: ${uniqueChunks.length}, Context length: ${truncatedContext.length} chars`);
    
    const timeoutMs = 25000;
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
        max_tokens: 400,
      }, {
        signal: controller.signal, // Add abort signal for timeout
      });
      
      clearTimeout(timeoutId);
      let answer = response.choices[0]?.message?.content || defaultErrorMessage;
      console.log(`${logPrefix}    Response: "${answer.substring(0, 150)}${answer.length > 150 ? '...' : ''}" (${answer.length} chars)`);
      
      // Check if GLM returned an error message - if so, try Gemini fallback
      const answerLower = answer.toLowerCase();
      const isErrorResponse = (answerLower.includes("sorry") && (answerLower.includes("couldn't generate") || answerLower.includes("try again"))) ||
                            (answerLower.includes("désolé") && (answerLower.includes("pas pu générer") || answerLower.includes("réessayer"))) ||
                            answer === defaultErrorMessage ||
                            answer === errorMessage;
      
      if (isErrorResponse && answer.length < 200) {
        console.log(`${logPrefix} ⚠️ GLM returned error message, trying fallback models...`);
        
        // Try Gemini models as fallback
        const fallbackModels = getGeminiFallbackModels();
        for (const modelName of fallbackModels) {
          try {
            console.log(`${logPrefix} 🔄 Trying Gemini fallback: ${modelName}...`);
            
            let geminiResponse: string;
            
            // Single request for Gemini models
            const originalModel = process.env.GEMINI_MODEL;
            process.env.GEMINI_MODEL = modelName;
            geminiResponse = await generateGeminiChatResponse(userMessage, documentChunks, requestId, expandedQuery, querySubjects);
            process.env.GEMINI_MODEL = originalModel;
            
            // Only use Gemini response if it's not also an error
            const geminiLower = geminiResponse.toLowerCase();
            const geminiIsError = geminiLower.includes("i cannot answer") || geminiLower.includes("je ne peux pas répondre");
            if (!geminiIsError || geminiResponse.length > answer.length) {
              console.log(`${logPrefix} ✅ Using Gemini fallback response from ${modelName} (${geminiResponse.length} chars)`);
              return geminiResponse;
            }
          } catch (fallbackError: any) {
            const errorMsg = fallbackError?.message?.toLowerCase() || '';
            // If rate limited, try next model
            if (errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('quota')) {
              console.log(`${logPrefix} ⚠️ ${modelName} rate limited, trying next model...`);
              continue;
            }
            console.error(`${logPrefix} ⚠️ Gemini ${modelName} fallback failed:`, fallbackError);
          }
        }
        
        // If all models fail, return the original GLM error response
        console.log(`${logPrefix} ⚠️ All fallback models failed, returning GLM response`);
      }
      
      console.log(`${logPrefix} ✅ Response received (${answer.length} chars)`);
      return answer;
    } catch (apiError: unknown) {
      clearTimeout(timeoutId);
      if (apiError instanceof Error && apiError.name === 'AbortError') {
        console.error(`${logPrefix} ⏱️ GLM request timed out after ${timeoutMs}ms`);
        // Try Gemini fallback on timeout (try available models)
        console.log(`${logPrefix} 🔄 GLM timed out, trying Gemini fallback models...`);
        const fallbackModels = getGeminiFallbackModels();
        for (const modelName of fallbackModels) {
          try {
            console.log(`${logPrefix} 🔄 Trying Gemini: ${modelName}...`);
            const originalModel = process.env.GEMINI_MODEL;
            process.env.GEMINI_MODEL = modelName;
            const geminiResponse = await generateGeminiChatResponse(userMessage, documentChunks, requestId, expandedQuery, querySubjects);
            process.env.GEMINI_MODEL = originalModel;
            console.log(`${logPrefix} ✅ Using Gemini fallback from ${modelName}`);
            return geminiResponse;
          } catch (fallbackError: any) {
            const errorMsg = fallbackError?.message?.toLowerCase() || '';
            if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
              continue; // Try next model
            }
            console.error(`${logPrefix} ⚠️ Gemini ${modelName} fallback failed:`, fallbackError);
          }
        }
        return langMessages.timeout;
      }
      throw apiError;
    }
  } catch (error) {
    console.error(`${logPrefix} GLM API error:`, error);
    
    // If GLM fails, try fallback to Gemini
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      // Check if it's a rate limit, timeout, or API error that might be recoverable with Gemini
      if (errorMsg.includes('timeout') || errorMsg.includes('rate limit') || errorMsg.includes('429') || errorMsg.includes('too large')) {
        console.log(`${logPrefix} 🔄 GLM failed (${error.message.substring(0, 100)}), trying Gemini as fallback...`);
        try {
          return await generateGeminiChatResponse(userMessage, documentChunks, requestId, expandedQuery, querySubjects);
        } catch (fallbackError) {
          console.error(`${logPrefix} ⚠️ Gemini fallback also failed:`, fallbackError);
          return defaultErrorMessage;
        }
      }
    }
    
    // For other errors, return error message instead of throwing
    return defaultErrorMessage;
  }
}

/**
 * Generate chat response using Gemma with parallel requests (for high-rate-limit models)
 * Sends 5 parallel requests with 100ms stagger to stay within 30 RPM limit
 */
async function generateGeminiChatResponseParallel(
  userMessage: string,
  documentChunks: TextChunk[],
  modelName: string,
  requestId?: string,
  expandedQuery?: string,
  querySubjects?: string[],
  parallelCount: number = 5
): Promise<string> {
  const logPrefix = requestId ? `[${requestId}]` : '';
  const client = getGeminiClient();
  
  // Find relevant chunks
  const searchQuery = expandedQuery || userMessage;
  const relevantChunks = findRelevantChunks(documentChunks, searchQuery, 6, querySubjects);
  const context = buildContextString(relevantChunks, userMessage);
  
  // Limit context size
  const MAX_CONTEXT_LENGTH = 500000;
  const truncatedContext = context.length > MAX_CONTEXT_LENGTH 
    ? context.substring(0, MAX_CONTEXT_LENGTH) + '\n\n[Context truncated...]'
    : context;
  
  // Detect language
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
  
  // Send parallel requests with small delays (100ms apart to stay within 30 RPM)
  const requests: Promise<string>[] = [];
  
  console.log(`${logPrefix} 🚀 Sending ${parallelCount} parallel requests to ${modelName} (staggered 100ms apart)...`);
  
  for (let i = 0; i < parallelCount; i++) {
    const requestPromise = (async () => {
      // Stagger requests by 100ms (30 RPM = 1 request per 2 seconds, so 5 requests over 500ms is safe)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, i * 100));
      }
      
      try {
        const model = client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const answer = result.response.text();
        console.log(`${logPrefix} ✅ Parallel request ${i + 1}/${parallelCount} succeeded (${answer.length} chars)`);
        return answer;
      } catch (error) {
        console.error(`${logPrefix} ⚠️ Parallel request ${i + 1}/${parallelCount} failed:`, error);
        throw error;
      }
    })();
    
    requests.push(requestPromise);
  }
  
  // Wait for first successful response (or all to complete)
  const results = await Promise.allSettled(requests);
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value && result.value.length > 50) {
      const answer = result.value;
      console.log(`${logPrefix} ✅ Using response from parallel request ${i + 1} (${answer.length} chars)`);
      return answer;
    }
  }
  
  // If all failed, return error message
  console.error(`${logPrefix} ⚠️ All ${parallelCount} parallel requests failed`);
  return langMessages.defaultError;
}

/**
 * Generate chat response using Ollama (self-hosted) with RAG context
 */
async function generateOllamaChatResponse(
  userMessage: string,
  documentChunks: TextChunk[],
  requestId?: string,
  expandedQuery?: string,
  querySubjects?: string[]
): Promise<string> {
  const logPrefix = requestId ? `[${requestId}]` : '';
  
  const client = getOllamaClient();
  const model = getOllamaModel();
  
  // Find relevant chunks using expanded query if provided
  const searchQuery = expandedQuery || userMessage;
  console.log(`${logPrefix} 🔎 Finding relevant chunks...`);
  const uniqueChunks = findRelevantChunks(documentChunks, searchQuery, 6, querySubjects);
  
  // Extract PDF links from relevant chunks
  const pdfLinks = new Set<string>();
  uniqueChunks.forEach(chunk => {
    if (chunk.pdfUrl) {
      pdfLinks.add(chunk.pdfUrl);
    }
  });
  
  const context = buildContextString(uniqueChunks, searchQuery);
  console.log(`${logPrefix} ✅ Found ${uniqueChunks.length} chunks`);
  
  // Limit context size
  const MAX_CONTEXT_LENGTH = 1000000;
  const truncatedContext = context.length > MAX_CONTEXT_LENGTH 
    ? context.substring(0, MAX_CONTEXT_LENGTH) + '\n\n[Context truncated due to size limit...]'
    : context;
  
  // Detect language
  const detectedLanguage = detectLanguage(userMessage);
  const isEnglish = detectedLanguage === 'en';
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

SPECIAL INSTRUCTIONS FOR INFO-PARENTS QUERIES:
- "Info-parents" (or "info parents", "infos-parents") are parent communication documents/newsletters
- When users ask about "info-parents" documents, look for content containing "info-parents", "info parents", or "infos-parents" in the context
- These documents typically contain announcements, important dates, school news, and information for parents
- If a user asks for a specific month/year (e.g., "info-parents of January 2024"), look for documents that mention both the month and year
- When summarizing info-parents documents, provide key information, important dates, and announcements
- Always include PDF download links when available in the context (format: /api/pdf/[filename])

Context information:
${truncatedContext || 'No context available.'}`;

  const userPrompt = userMessage;

  try {
    console.log(`${logPrefix} 🤖 [AI CALL] Ollama (${model}) - Chat Response Generation`);
    console.log(`${logPrefix}    User message: "${userMessage.substring(0, 150)}${userMessage.length > 150 ? '...' : ''}"`);
    console.log(`${logPrefix}    Context chunks: ${uniqueChunks.length}, Context length: ${truncatedContext.length} chars`);
    
    const timeoutMs = 60000; // 60 seconds for local models (can be slower)
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
        max_tokens: 400,
      }, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const answer = response.choices[0]?.message?.content || defaultErrorMessage;
      console.log(`${logPrefix}    Response: "${answer.substring(0, 150)}${answer.length > 150 ? '...' : ''}" (${answer.length} chars)`);
      console.log(`${logPrefix} ✅ Response received (${answer.length} chars)`);
      return answer;
    } catch (apiError: unknown) {
      clearTimeout(timeoutId);
      if (apiError instanceof Error && apiError.name === 'AbortError') {
        console.error(`${logPrefix} ⏱️ Ollama request timed out after ${timeoutMs}ms`);
        return langMessages.timeout;
      }
      throw apiError;
    }
  } catch (error) {
    console.error(`${logPrefix} Ollama API error:`, error);
    return defaultErrorMessage;
  }
}

/**
 * Generate chat response using Google Gemini with RAG context
 */
async function generateGeminiChatResponse(
  userMessage: string,
  documentChunks: TextChunk[],
  requestId?: string,
  expandedQuery?: string,
  querySubjects?: string[]
): Promise<string> {
  const logPrefix = requestId ? `[${requestId}]` : '';
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: getGeminiModel() });
  
  // Find relevant chunks using expanded query if provided
  const searchQuery = expandedQuery || userMessage;
  const relevantChunks = findRelevantChunks(documentChunks, searchQuery, 6, querySubjects);
  const context = buildContextString(relevantChunks, userMessage);
  
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



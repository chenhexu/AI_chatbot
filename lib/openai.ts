import OpenAI from 'openai';
import { findRelevantChunks, buildContextString, type TextChunk } from './rag';
import { expandQuery } from './queryExpander';

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
 * Generate chat response using OpenAI with RAG context
 */
export async function generateChatResponse(
  userMessage: string,
  documentChunks: TextChunk[],
  requestId?: string
): Promise<string> {
  const logPrefix = requestId ? `[${requestId}]` : '';
  const client = getOpenAIClient();
  // Try gpt-5-nano first, fallback to gpt-4o-mini if not available
  const model = process.env.OPENAI_MODEL || 'gpt-5-nano';
  
  // Expand query using Gemini Flash for better RAG matching
  // This translates, expands synonyms, and generates French keywords
  let searchQuery = userMessage;
  try {
    const expanded = await expandQuery(userMessage);
    if (expanded && expanded !== userMessage) {
      console.log(`${logPrefix} 🧠 Expanded query for RAG search`);
      searchQuery = expanded;
    }
  } catch (error) {
    // Never crash on expansion - just use original
    console.warn(`${logPrefix} ⚠️ Query expansion error (continuing with original):`, error);
  }
  
  // Find relevant chunks using expanded query
  const uniqueChunks = findRelevantChunks(documentChunks, searchQuery, 6);
  const context = buildContextString(uniqueChunks);
  
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
  
  // Detect language from user message (simple heuristic)
  const detectLanguage = (text: string): 'en' | 'fr' => {
    const lowerText = text.toLowerCase();
    // Common English words
    const englishWords = ['the', 'is', 'are', 'who', 'what', 'where', 'when', 'why', 'how', 'can', 'will', 'would', 'should', 'could'];
    // Common French words
    const frenchWords = ['le', 'la', 'les', 'qui', 'quoi', 'où', 'quand', 'pourquoi', 'comment', 'peut', 'peuvent', 'sera', 'serait', 'devrait'];
    
    let englishCount = 0;
    let frenchCount = 0;
    
    for (const word of englishWords) {
      if (lowerText.includes(word)) englishCount++;
    }
    for (const word of frenchWords) {
      if (lowerText.includes(word)) frenchCount++;
    }
    
    // If more English indicators, return English, otherwise default to French
    return englishCount > frenchCount ? 'en' : 'fr';
  };
  
  const detectedLanguage = detectLanguage(userMessage);
  const isEnglish = detectedLanguage === 'en';
  
  // Build language-specific error messages
  const errorMessage = isEnglish 
    ? "I cannot answer this question with the information I have. Could you rephrase your question or contact the school directly?"
    : "Je ne peux pas répondre à cette question avec les informations dont je dispose. Pourriez-vous reformuler votre question ou contacter directement l'école?";
  
  const defaultErrorMessage = isEnglish
    ? "Sorry, I couldn't generate a response. Please try again."
    : "Désolé, je n'ai pas pu générer de réponse. Veuillez réessayer.";
  
  // Build system prompt with explicit language instruction
  const languageInstruction = isEnglish 
    ? `**CRITICAL LANGUAGE RULE**: The user's question is in ENGLISH. You MUST respond in ENGLISH only. Do not respond in French.`
    : `**RÈGLE DE LANGUE CRITIQUE**: La question de l'utilisateur est en FRANÇAIS. Vous DEVEZ répondre en FRANÇAIS uniquement.`;
  
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
    // If model is gpt-5-nano and it fails, fallback to gpt-4o-mini
    let actualModel = model;
    try {
      const response = await client.chat.completions.create({
        model: actualModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const answer = response.choices[0]?.message?.content || defaultErrorMessage;
      
      return answer;
    } catch (modelError: any) {
      // If gpt-5-nano doesn't exist, fallback to gpt-4o-mini
      if (actualModel === 'gpt-5-nano' && (modelError?.message?.includes('model') || modelError?.code === 'model_not_found')) {
        console.warn('⚠️  gpt-5-nano not available, falling back to gpt-4o-mini');
        actualModel = 'gpt-4o-mini';
        const response = await client.chat.completions.create({
          model: actualModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 500,
        });

        const answer = response.choices[0]?.message?.content || defaultErrorMessage;
        return answer;
      }
      throw modelError;
    }
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error(
      `Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}



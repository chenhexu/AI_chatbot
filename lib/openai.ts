import OpenAI from 'openai';
import { findRelevantChunks, buildContextString, type TextChunk } from './rag';

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
  documentChunks: TextChunk[]
): Promise<string> {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-nano';
  
  // Find relevant chunks for the user's query
  // Reduced to 3 chunks to avoid token limit (400K tokens)
  const relevantChunks = findRelevantChunks(documentChunks, userMessage, 3);
  const context = buildContextString(relevantChunks);
  
  // Limit context size to avoid token limit errors
  // Rough estimate: 1 token ≈ 4 characters, so 400K tokens ≈ 1.6M characters
  // Leave room for prompt and response, so limit context to ~1M characters
  const MAX_CONTEXT_LENGTH = 1000000; // ~250K tokens
  const truncatedContext = context.length > MAX_CONTEXT_LENGTH 
    ? context.substring(0, MAX_CONTEXT_LENGTH) + '\n\n[Context truncated due to size limit...]'
    : context;
  
  // Log for debugging (remove in production if desired)
  console.log(`Query: "${userMessage}" - Found ${relevantChunks.length} relevant chunks out of ${documentChunks.length} total chunks`);
  
  // Build system prompt
  const systemPrompt = `You are a helpful AI assistant for Collège Saint-Louis, a French secondary school in Quebec, Canada. 
Your role is to answer questions about the school based on the information provided to you.

IMPORTANT RULES:
- Answer questions based on the context information provided below
- If the information is clearly not in the provided context, say "Je ne peux pas répondre à cette question avec les informations dont je dispose. Pourriez-vous reformuler votre question ou contacter directement l'école?"
- Answer in French (the school's language)
- Be helpful, friendly, and professional
- Try to infer reasonable answers from the context even if not explicitly stated
- For questions about staff/personnel, look for names, roles, and titles in the context
- For questions about the school, use any relevant information from the context

Context information about Collège Saint-Louis:
${truncatedContext || 'No specific context available. Please inform the user that you need more information.'}`;

  // Build user message
  const userPrompt = context 
    ? `Question de l'utilisateur: ${userMessage}`
    : userMessage;

  try {
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const answer = response.choices[0]?.message?.content || 
      "Désolé, je n'ai pas pu générer de réponse. Veuillez réessayer.";
    
    return answer;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error(
      `Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}



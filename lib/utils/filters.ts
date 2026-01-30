/**
 * Shared utility functions for filtering and text processing
 * Optimized for performance on single-core systems
 */

/**
 * Check if a chunk source is CSS/JS/non-content (optimized)
 * Uses a single lowercase conversion and checks all patterns at once
 */
export function isNonContentChunk(source: string | undefined, text?: string): boolean {
  if (!source) return false;
  
  const sourceLower = source.toLowerCase();
  
  // Single check for all CSS/JS patterns (faster than multiple includes)
  const nonContentPatterns = [
    '.css', '.js', '.min.', 'stylesheet', 
    'block-library', 'metaslider', 'assets_css', 'assets_js'
  ];
  
  if (nonContentPatterns.some(pattern => sourceLower.includes(pattern))) {
    return true;
  }
  
  // Check text content for CSS patterns (only if text provided)
  if (text) {
    const textPreview = text.substring(0, 200).toLowerCase();
    const braceCount = (textPreview.match(/[{;}]/g) || []).length;
    if (braceCount > 10 || 
        textPreview.includes('@charset') ||
        textPreview.includes('@media') ||
        textPreview.startsWith('@')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Filter chunks to remove CSS/JS/non-content chunks
 * Optimized batch filtering
 */
export function filterContentChunks<T extends { source?: string; text?: string }>(
  chunks: T[]
): T[] {
  return chunks.filter(chunk => !isNonContentChunk(chunk.source, chunk.text));
}

/**
 * Language detection utility (shared between OpenAI and Gemini)
 * Optimized with early returns
 */
export function detectLanguage(text: string): 'en' | 'fr' {
  const lowerText = text.toLowerCase();
  
  // Common English words (most frequent first for early exit)
  const englishWords = ['the', 'is', 'are', 'who', 'what', 'where', 'when', 'why', 'how', 'can', 'will'];
  // Common French words
  const frenchWords = ['le', 'la', 'les', 'qui', 'quoi', 'où', 'quand', 'pourquoi', 'comment', 'peut'];
  
  let englishCount = 0;
  let frenchCount = 0;
  
  // Early exit optimization: check most common words first
  for (const word of englishWords) {
    if (lowerText.includes(word)) {
      englishCount++;
      if (englishCount >= 2) break; // Early exit if enough English indicators
    }
  }
  
  for (const word of frenchWords) {
    if (lowerText.includes(word)) {
      frenchCount++;
      if (frenchCount >= 2) break; // Early exit if enough French indicators
    }
  }
  
  return englishCount > frenchCount ? 'en' : 'fr';
}

/**
 * Get language-specific error messages (shared utility)
 */
export function getLanguageMessages(language: 'en' | 'fr') {
  if (language === 'en') {
    return {
      noInfo: "I cannot answer this question with the information I have. Could you rephrase your question or contact the school directly?",
      defaultError: "Sorry, I couldn't generate a response. Please try again.",
      timeout: "The request took too long. Please try again with a simpler question.",
      languageInstruction: "**CRITICAL LANGUAGE RULE**: The user's question is in ENGLISH. You MUST respond in ENGLISH only. Do not respond in French."
    };
  } else {
    return {
      noInfo: "Je ne peux pas répondre à cette question avec les informations dont je dispose. Pourriez-vous reformuler votre question ou contacter directement l'école?",
      defaultError: "Désolé, je n'ai pas pu générer de réponse. Veuillez réessayer.",
      timeout: "La requête a pris trop de temps. Veuillez réessayer avec une question plus simple.",
      languageInstruction: "**RÈGLE DE LANGUE CRITIQUE**: La question de l'utilisateur est en FRANÇAIS. Vous DEVEZ répondre en FRANÇAIS uniquement."
    };
  }
}

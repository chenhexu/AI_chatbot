/**
 * OCR Text Corrector
 * Post-processes OCR text to fix common errors, especially with French accents
 * and visual separators that OCR misreads
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Check if a word looks suspicious (likely OCR error)
 */
function isSuspiciousWord(word: string): boolean {
  // Remove common punctuation at start/end
  const cleanWord = word.replace(/^[^\w\u00C0-\u017F]+|[^\w\u00C0-\u017F]+$/g, '');
  
  if (cleanWord.length < 2) return false; // Too short to be suspicious
  
  // Check for suspicious patterns:
  // 1. Contains parentheses in the middle (not at start/end) - e.g., "f (aise"
  if (/[a-zA-Z\u00C0-\u017F]\s*\([^)]*\)\s*[a-zA-Z\u00C0-\u017F]/.test(cleanWord)) {
    return true;
  }
  
  // 2. Contains space in middle of word (after letter, before letter)
  if (/[a-zA-Z\u00C0-\u017F]\s+[a-zA-Z\u00C0-\u017F]/.test(cleanWord)) {
    return true;
  }
  
  // 3. Contains special characters in middle (like "f (aise" or "préparat;on")
  if (/[a-zA-Z\u00C0-\u017F][^\w\u00C0-\u017F]+[a-zA-Z\u00C0-\u017F]/.test(cleanWord)) {
    return true;
  }
  
  // 4. Starts with lowercase but has uppercase in middle (unusual)
  if (/^[a-z\u00E0-\u017F][A-Z\u00C0-\u017F]/.test(cleanWord)) {
    return true;
  }
  
  // 5. Contains multiple consecutive special chars (not at start/end)
  if (/[a-zA-Z\u00C0-\u017F][^\w\u00C0-\u017F]{2,}[a-zA-Z\u00C0-\u017F]/.test(cleanWord)) {
    return true;
  }
  
  return false;
}

/**
 * Normalize word for comparison (remove spaces, parentheses, etc.)
 */
function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/\s+/g, '')           // Remove spaces
    .replace(/[()]/g, '')          // Remove parentheses
    .replace(/[^\w\u00C0-\u017F]/g, ''); // Remove other special chars
}

/**
 * French word dictionary - common words and recipe terms
 * Focused on recipe-related vocabulary and common OCR errors
 */
const FRENCH_WORDS = [
  // Recipe terms
  'fraise', 'frais',
  'préparation', 'preparation', 'preparer',
  'cuisson', 'cuire', 'cuit', 'cuite',
  'ingrédients', 'ingredients', 'ingredient',
  'portions', 'portion',
  'recette', 'recettes',
  'ricardo', 'ricardocuisine',
  'lentilles', 'lentille',
  'pommes', 'pomme', 'pommes de terre', 'pomme de terre',
  'cari', 'curry',
  'coriandre', 'coriandres',
  'coco', 'lait de coco',
  'lait',
  'huile', 'huile d\'olive',
  'oignon', 'oignons',
  'ail', 'ails',
  'garam', 'masala', 'garam masala',
  'bouillon', 'bouillons',
  'poulet', 'poulets',
  'tomates', 'tomate',
  'eau', 'eaux',
  'sel', 'sels',
  'poivre', 'poivres',
  'suggestion', 'suggestions',
  'équipe', 'equipe',
  'note', 'notes',
  'remplacer',
  'ajouter', 'ajoute', 'ajouté', 'ajoutée',
  'dorer', 'doré', 'dorée',
  'mijoter', 'mijote', 'mijoté',
  'servir', 'servi', 'servie',
  'garnir', 'garni', 'garnie',
  'coupées', 'coupé', 'coupée', 'couper',
  'hachées', 'haché', 'hachée', 'hacher',
  'finement', 'fines',
  'gros', 'grosse', 'grosses',
  'boîte', 'boite', 'boîtes', 'boites',
  'tasse', 'tasses',
  'cuillère', 'cuillères', 'cuillere', 'cuilleres',
  'soupe', 'soupes',
  'gousses', 'gousse',
  'litre', 'litres',
  'minute', 'minutes', 'min',
  'heure', 'heures', 'h',
  'facultatif', 'facultative',
  'végétarien', 'vegetarien', 'végétarienne', 'vegetarienne',
  'pâté', 'pate', 'pates',
  'chinois', 'chinoise', 'chinoises',
  'légumes', 'legumes', 'legume',
  'grains', 'grain',
  'sarrasin', 'sarrasins',
  'africain', 'africaine', 'africaines',
  'mafé', 'mafe',
  'basmati', 'riz',
  'découvert', 'decouvert', 'découverte', 'decouverte',
  'environ', 'environs',
  'jusqu\'à', 'jusqua',
  'tendres', 'tendre',
  'rectifier', 'rectifie', 'rectifié',
  'assaisonnement', 'assaisonner',
  // Common French words (most frequent)
  'de', 'des', 'du', 'le', 'la', 'les', 'un', 'une', 'et', 'ou',
  'dans', 'sur', 'avec', 'sans', 'pour', 'par', 'est', 'sont',
  'avoir', 'faire', 'être', 'aller', 'venir', 'voir',
].map(w => w.toLowerCase());

/**
 * Find the best matching word from dictionary using fuzzy matching
 */
function findBestMatch(word: string, maxDistance: number = 2): string | null {
  const normalized = normalizeWord(word);
  let bestMatch: string | null = null;
  let bestDistance = Infinity;
  
  for (const dictWord of FRENCH_WORDS) {
    const dictNormalized = normalizeWord(dictWord);
    const distance = levenshteinDistance(normalized, dictNormalized);
    
    if (distance < bestDistance && distance <= maxDistance) {
      bestDistance = distance;
      bestMatch = dictWord;
    }
  }
  
  // Only return match if distance is reasonable
  if (bestDistance <= maxDistance && bestMatch) {
    return bestMatch;
  }
  
  return null;
}

/**
 * Correct OCR text by fixing suspicious words
 */
export function correctOCRText(text: string): string {
  // First, fix common OCR patterns where letters are separated by spaces/parentheses
  // e.g., "F (aise" -> "Fraise"
  let fixedText = text
    // Fix pattern: single letter + space + ( + letters -> combine (e.g., "F (aise" -> "Fraise")
    .replace(/([a-zA-Z\u00C0-\u017F])\s*\(\s*([a-zA-Z\u00C0-\u017F]{3,})/g, (match, p1, p2) => {
      const combined = p1 + p2;
      const matchResult = findBestMatch(combined, 2);
      if (matchResult && process.env.DEBUG_OCR_CORRECTIONS === 'true') {
        console.log(`  🔧 OCR Pattern Fix: "${match}" → "${matchResult}"`);
      }
      return matchResult ? matchResult : match; // Return corrected or original
    });
  
  // Split text into words while preserving whitespace and punctuation
  const words = fixedText.split(/(\s+|[^\w\s\u00C0-\u017F])/);
  const corrected: string[] = [];
  let correctionsCount = 0;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // Skip whitespace and punctuation
    if (/^\s*$/.test(word) || /^[^\w\s\u00C0-\u017F]+$/.test(word)) {
      corrected.push(word);
      continue;
    }
    
    // Check if word is suspicious
    if (isSuspiciousWord(word)) {
      const match = findBestMatch(word, 2);
      
      if (match) {
        // Preserve original capitalization if word starts with uppercase
        const correctedWord = word[0] === word[0].toUpperCase() 
          ? match.charAt(0).toUpperCase() + match.slice(1)
          : match;
        
        corrected.push(correctedWord);
        correctionsCount++;
        
        // Log correction for debugging
        if (process.env.DEBUG_OCR_CORRECTIONS === 'true') {
          console.log(`  🔧 OCR Correction: "${word}" → "${correctedWord}"`);
        }
      } else {
        // No good match found, keep original
        corrected.push(word);
      }
    } else {
      // Word looks fine, keep it
      corrected.push(word);
    }
  }
  
  // Suppress correction count logging to speed up processing
  // Only log in debug mode
  if (correctionsCount > 0 && process.env.DEBUG_OCR_CORRECTIONS === 'true') {
    console.log(`  ✨ Applied ${correctionsCount} OCR correction(s)`);
  }
  
  return corrected.join('');
}


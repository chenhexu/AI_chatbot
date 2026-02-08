import levenshtein from 'fast-levenshtein';
import { isNonContentChunk } from './utils/filters';

export interface TextChunk {
  text: string;
  source: string;
  index: number;
  pdfUrl?: string; // Original PDF URL/path for PDF text files
  subject?: string; // Subject classification (e.g., 'staff', 'academics', 'general')
}

/**
 * Split text into chunks with overlap, respecting sentence and word boundaries
 * Improved to preserve structured lists and sections
 */
export function chunkText(text: string, chunkSize: number = 1500, overlap: number = 300): string[] {
  const chunks: string[] = [];
  
  // First, identify and preserve structured sections (lists, headings, etc.)
  // Split by double newlines first to get paragraphs/sections
  const sections = text.split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 0);
  
  if (sections.length === 0) {
    return [text.trim()];
  }
  
  let currentChunk = '';
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    
    // Check if this section is a heading or list header (like "Membres du personnel")
    const isHeading = /^[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ\s:]+$/.test(section) || 
                     /^Membres (du|de la|élèves)/i.test(section);
    
    // Check if next section is part of a list (starts with bullet, dash, or name pattern)
    // Also check for table patterns (activity tables with years, names, etc.)
    const nextSection = i + 1 < sections.length ? sections[i + 1] : '';
    const isListStart = isHeading && (
      /^[-•*]\s/.test(nextSection) || 
      /^[A-ZÀÁÂÃÄÅÆÇÈÉÊË][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ]/.test(nextSection) ||
      /^[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+,\s/.test(nextSection)
    );
    
    // Check if this section looks like a table (contains activity names, years, etc.)
    const isTableSection = /\d{4}[-–]\d{4}|responsable|activité|bazar|expo|science/i.test(section) &&
                           (/\|\s*[A-Z]|\t[A-Z]/.test(section) || // Table-like formatting
                            /^\s*[A-Z].*\d{4}/.test(section)); // Name followed by year
    
    // If this is a list header, try to keep it with its list items
    if (isListStart) {
      // Collect the heading and following list items
      let listContent = section;
      let j = i + 1;
      
      // Collect consecutive list items or table rows
      while (j < sections.length) {
        const item = sections[j];
        // Check if it's a list item (name pattern, bullet, etc.)
        const isListItem = /^[-•*]\s/.test(item) || 
                          /^[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+,\s/.test(item) ||
                          /^[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ]/.test(item);
        
        // Check if it's a table row (contains activity name + year pattern)
        const isTableRow = /\d{4}[-–]\d{4}/.test(item) && 
                          (/\|\s*[A-Z]|\t[A-Z]/.test(item) || // Table formatting
                           /[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+.*\d{4}/.test(item)); // Name + year
        
        if (isListItem || isTableRow) {
          listContent += '\n\n' + item;
          j++;
        } else {
          // If we've collected table rows, continue a bit more to get complete table
          if (isTableRow && j < sections.length - 1) {
            const nextItem = sections[j + 1];
            // If next item also looks like table row, include it
            if (/\d{4}[-–]\d{4}/.test(nextItem)) {
              listContent += '\n\n' + item;
              j++;
              continue;
            }
          }
          break;
        }
      }
      
      // Now handle this complete list as a unit
      const potentialChunk = currentChunk 
        ? currentChunk + '\n\n' + listContent
        : listContent;
      
      if (potentialChunk.length > chunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        // For overlap, try to keep some context
        if (overlap > 0 && currentChunk.length > overlap) {
          const overlapStart = Math.max(0, currentChunk.length - overlap);
          const overlapText = currentChunk.substring(overlapStart);
          const sentenceMatch = overlapText.match(/[.!?]\s+/);
          if (sentenceMatch && sentenceMatch.index !== undefined) {
            const sentenceEnd = overlapStart + sentenceMatch.index + sentenceMatch[0].length;
            currentChunk = currentChunk.substring(sentenceEnd) + '\n\n' + listContent;
          } else {
            currentChunk = listContent;
          }
        } else {
          currentChunk = listContent;
        }
      } else {
        currentChunk = potentialChunk;
      }
      
      i = j - 1; // Skip the list items we just processed
      continue;
    }
    
    // Normal paragraph handling
    const potentialChunk = currentChunk 
      ? currentChunk + '\n\n' + section
      : section;
    
    if (potentialChunk.length > chunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      
      // Start new chunk with overlap
      if (overlap > 0 && currentChunk.length > overlap) {
        const overlapStart = Math.max(0, currentChunk.length - overlap);
        const overlapText = currentChunk.substring(overlapStart);
        
        const sentenceMatch = overlapText.match(/[.!?]\s+/);
        if (sentenceMatch && sentenceMatch.index !== undefined) {
          const sentenceEnd = overlapStart + sentenceMatch.index + sentenceMatch[0].length;
          currentChunk = currentChunk.substring(sentenceEnd) + '\n\n' + section;
        } else {
          const paragraphMatch = overlapText.match(/\n\n/);
          if (paragraphMatch && paragraphMatch.index !== undefined) {
            currentChunk = currentChunk.substring(overlapStart + paragraphMatch.index + 2) + '\n\n' + section;
          } else {
            const wordMatch = overlapText.search(/\s+\w/);
            if (wordMatch > 0) {
              currentChunk = currentChunk.substring(overlapStart + wordMatch + 1) + '\n\n' + section;
            } else {
              currentChunk = section;
            }
          }
        }
      } else {
        currentChunk = section;
      }
    } else {
      currentChunk = potentialChunk;
    }
  }
  
  // Add the last chunk
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  if (chunks.length === 0) {
    return [text.trim()];
  }
  
  return chunks;
}

/**
 * Calculate text similarity score with better differentiation
 * Improved to give much higher scores to chunks with actual relevant content
 */
export function calculateSimilarity(query: string, text: string, source?: string): number {
  // Use shared utility for non-content check (optimized)
  if (isNonContentChunk(source, text)) {
    const baseScore = calculateSimilarityInternal(query, text);
    return baseScore * 0.2; // Reduce score by 80% for CSS/JS files
  }
  
  return calculateSimilarityInternal(query, text);
}

// Cache for compiled regex patterns (performance optimization)
const wordBoundaryCache = new Map<string, RegExp>();

function getWordBoundaryRegex(word: string): RegExp {
  if (!wordBoundaryCache.has(word)) {
    wordBoundaryCache.set(word, new RegExp(`\\b${word}\\b`, 'i'));
  }
  return wordBoundaryCache.get(word)!;
}

function calculateSimilarityInternal(query: string, text: string): number {
  // Cache lowercase conversions (used multiple times)
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  // Remove common French stop words and punctuation (cached set)
  const stopWords = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'qui', 'que', 'quoi', 'dont', 'où', 'sont', 'est', 'avez', 'a', 'ont', 'son', 'sont']);
  
  // Pre-process query words once (optimized)
  const queryWords = queryLower
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w));
  
  if (queryWords.length === 0) {
    queryWords.push(queryLower.replace(/[^\w\s]/g, ' ').trim());
  }
  
  // Check for exact phrase match (highest priority)
  const exactPhraseMatch = textLower.includes(queryLower);
  
  // Check for key phrase patterns (e.g., "membres du personnel", "personnel de l'école")
  // IMPORTANT: Check for specific phrases FIRST to avoid false matches
  const keyPhrases: string[] = [];
  
  // Check for "projet personnel" FIRST (before generic "personnel")
  // Also handle typo "project" instead of "projet"
  const hasProjetPersonnel = queryLower.includes('projet personnel') || 
                              queryLower.includes('projets personnels') ||
                              queryLower.includes('project personnel') ||
                              queryLower.includes('projects personnels');
  
  if (hasProjetPersonnel) {
    keyPhrases.push('projet personnel', 'projets personnels', 'projet personel', 'projets personels', 'project personnel', 'projects personnels');
  }
  
  // Only add generic "personnel" if NOT asking about "projet personnel"
  // Also check for "project" typo
  const isAboutStaff = (queryLower.includes('personnel') || queryLower.includes('personnels')) && 
                       !hasProjetPersonnel;
  
  if (isAboutStaff) {
    keyPhrases.push('membres du personnel', 'membres de la personnel', 'personnel');
  }
  
  // Check for schedule/horaire related queries
  if (queryLower.includes('horaire') || queryLower.includes('schedule') || queryLower.includes('calendrier') || queryLower.includes('grille-matière')) {
    keyPhrases.push('horaire', 'calendrier', 'grille-matière', 'grille matière', 'horaire des examens', 'horaire des cours');
  }
  
  // Check for activity-related queries (Bazar vert, Expo Science, Robotique, etc.)
  if (queryLower.includes('responsable') || queryLower.includes('activité') || queryLower.includes('activite')) {
    keyPhrases.push('responsable', 'activité', 'activite', 'activités', 'activites');
  }
  
  // Check for student life (vie étudiante) queries
  if (queryLower.includes('vie étudiante') || queryLower.includes('vie etudiant') || queryLower.includes('vie etudiante')) {
    keyPhrases.push('vie étudiante', 'vie etudiant', 'vie etudiante', 'activités midi', 'activites midi', 'activité midi', 'activite midi');
  }
  
  // Check for specific activity names
  if (queryLower.includes('robotique') || queryLower.includes('robotics')) {
    keyPhrases.push('robotique', 'robotics', 'club de robotique', 'club robotique');
  }
  
  // Check for cafeteria/food-related queries
  if (queryLower.includes('cafétéria') || queryLower.includes('cafeteria') || queryLower.includes('végé') || queryLower.includes('vegetarien') || queryLower.includes('végétarien')) {
    keyPhrases.push('cafétéria', 'cafeteria', 'végétarien', 'vegetarien', 'végé', 'vege', 'végétarisme', 'vegetarisme');
  }
  
  // Check for Info-parents queries
  if (queryLower.includes('info-parents') || queryLower.includes('info parents') || queryLower.includes('infos-parents')) {
    keyPhrases.push('info-parents', 'info parents', 'infos-parents', 'info-parent', 'infos parent');
  }
  
  if (queryLower.includes('directrice') || queryLower.includes('directeur') || queryLower.includes('directice') || queryLower.includes('principal')) {
    keyPhrases.push('directrice', 'directeur', 'directice', 'direction', 'mot de la direction', 'principal', 'principale');
  }
  
  // Check for recipe/ingredient queries
  if (queryLower.includes('ingrédient') || queryLower.includes('ingredient') || queryLower.includes('recette') || queryLower.includes('recipe')) {
    keyPhrases.push('ingrédients', 'ingredients', 'recette', 'recipe', 'préparation', 'preparation');
  }
  
  // Check for specific recipe names (cari, curry, lentilles, etc.)
  if (queryLower.includes('cari') || queryLower.includes('curry') || queryLower.includes('lentille') || queryLower.includes('lentil')) {
    keyPhrases.push('cari', 'curry', 'lentilles', 'lentils', 'lentille', 'lentil');
  }
  
  if (queryLower.includes('ricardo')) {
    keyPhrases.push('ricardo');
  }
  
  let keyPhraseMatches = 0;
  for (const phrase of keyPhrases) {
    if (textLower.includes(phrase)) {
      keyPhraseMatches++;
    }
  }
  
  // Count exact word matches (with typo tolerance for common words)
  // Give lower weight to very common words like "école", "collège"
  const commonWords = new Set(['ecole', 'école', 'collège', 'college', 'établissement', 'etablissement']);
  let exactMatches = 0;
  let partialMatches = 0;
  
  // Check if query is about "projet personnel" to penalize generic "personnel" matches
  const isProjetPersonnelQuery = hasProjetPersonnel;
  
  for (const word of queryWords) {
    // Exact word match (case-insensitive) - use cached regex
    const wordBoundaryRegex = getWordBoundaryRegex(word);
    const isCommonWord = commonWords.has(word);
    
    // Special handling for activity names - give them very high weight
    const activityWords = ['robotique', 'robotics', 'improvisation', 'theatre', 'théâtre', 'spectacle', 'bazar', 'expo', 'science', 'math', 'dele', 'fablab', 'journal', 'variétés', 'varietes'];
    const isActivityWord = activityWords.includes(word.toLowerCase());
    
    // If query is about "projet personnel", heavily penalize standalone "personnel" matches
    if (isProjetPersonnelQuery && (word === 'personnel' || word === 'personnels')) {
      // Only count if it's part of "projet personnel" phrase, not standalone
      const projetPersonnelRegex = /projet\s+personnel|projets\s+personnels|project\s+personnel|projects\s+personnels/i;
      if (projetPersonnelRegex.test(textLower)) {
        exactMatches += 2.0; // High weight for "projet personnel" phrase
      } else {
        // Standalone "personnel" gets very low weight when query is about "projet personnel"
        exactMatches += 0.1; // Very low weight to avoid false matches
      }
      continue;
    }
    
    if (wordBoundaryRegex.test(textLower)) {
      // Activity words get very high weight
      if (isActivityWord) {
        exactMatches += 3.0; // Very high weight for activity names
      } else if (isCommonWord) {
        exactMatches += 0.3; // Reduced weight for common words
      } else {
        exactMatches++;
      }
    } else if (word.length <= 2 || isCommonWord) {
      // Skip fuzzy matching for very short words or common words (not worth the computation)
      // Just do simple substring check
      if (textLower.includes(word)) {
        partialMatches += 0.1;
      }
    } else {
      // Try fuzzy matching for close matches (OPTIMIZED: limit search to reduce computation)
      // Only check words that start with the same letter (much faster)
      const wordFirstLetter = word[0]?.toLowerCase();
      let fuzzyMatchFound = false;
      
      // Extract words from text (similar to query words processing)
      // OPTIMIZATION: Only extract words that start with the same letter as the query word
      const textWords = textLower
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1 && !stopWords.has(w) && w[0]?.toLowerCase() === wordFirstLetter);
      
      // OPTIMIZATION: Limit to first 30 matching words to avoid excessive computation
      const limitedTextWords = textWords.slice(0, 30);
      
      // Calculate similarity for each text word
      for (const textWord of limitedTextWords) {
        // Skip if words are too different in length (more than 50% difference)
        if (Math.abs(word.length - textWord.length) > Math.max(word.length, textWord.length) * 0.5) {
          continue;
        }
        
        // Quick substring check first (much faster than Levenshtein)
        if (textWord.includes(word) || word.includes(textWord)) {
          fuzzyMatchFound = true;
          if (isActivityWord) {
            partialMatches += 1.2;
          } else if (isCommonWord) {
            partialMatches += 0.1;
          } else {
            partialMatches += 0.4;
          }
          break;
        }
        
        // Only calculate Levenshtein if substring match failed
        const maxLen = Math.max(word.length, textWord.length);
        if (maxLen === 0) continue;
        
        const dist = levenshtein.get(word, textWord);
        const similarity = 1 - (dist / maxLen); // Similarity score 0-1
        
        // If similarity is high enough (>= 0.75), consider it a fuzzy match
        if (similarity >= 0.75) {
          fuzzyMatchFound = true;
          // Give fuzzy matches lower weight than exact matches
          if (isActivityWord) {
            partialMatches += 1.5; // Medium-high weight for activity fuzzy matches
          } else if (isCommonWord) {
            partialMatches += 0.1; // Very low weight for common words
          } else {
            partialMatches += 0.5 * similarity; // Weight based on similarity
          }
          break; // Found a match, no need to check other words
        }
      }
      
      // Fallback to substring matching if fuzzy matching didn't find anything
      if (!fuzzyMatchFound) {
        // Try fuzzy matching for common typos
        if (word === 'directice') {
          // Match "directrice" even if query has typo "directice"
          if (/\bdirectrice\b/i.test(textLower)) {
            exactMatches += 1.5; // Higher weight for director-related matches
          } else if (textLower.includes('directrice') || textLower.includes('directice')) {
            partialMatches += 0.7;
          }
        } else if (word === 'project' && isProjetPersonnelQuery) {
          // Handle typo "project" instead of "projet"
          if (/projet\s+personnel|project\s+personnel/i.test(textLower)) {
            exactMatches += 2.0; // High weight
          }
        } else if (textLower.includes(word)) {
          if (isCommonWord) {
            partialMatches += 0.1; // Very low weight for common words
          } else {
            partialMatches += 0.3;
          }
        }
      }
    }
  }
  
  // Check for related terms (French synonyms/related words) with typo tolerance
  const relatedTerms: { [key: string]: string[] } = {
    'personnel': ['personnels', 'membres', 'employés', 'employes', 'staff', 'équipe', 'equipe'],
    'personnels': ['personnel', 'membres', 'employés', 'employes', 'staff', 'équipe', 'equipe'],
    'directrice': ['directeur', 'direction', 'directrice', 'directice', 'principal', 'principale'], // Include English "principal"
    'directice': ['directrice', 'directeur', 'direction', 'principal', 'principale'], // Handle typo
    'directeur': ['directrice', 'direction', 'directice', 'principal', 'principale'],
    'principal': ['directrice', 'directeur', 'direction', 'principale', 'principal'], // English "principal" maps to French director terms
    'principale': ['directrice', 'directeur', 'direction', 'principal'],
    'élèves': ['eleves', 'étudiants', 'etudiants', 'students'],
    'étudiants': ['eleves', 'élèves', 'etudiants', 'students'],
    'école': ['ecole', 'collège', 'college', 'établissement', 'etablissement'],
    'collège': ['ecole', 'école', 'college', 'établissement', 'etablissement'],
    'végé': ['végétarien', 'vegetarien', 'végétarisme', 'vegetarisme', 'végé', 'vege'],
    'vegetarien': ['végétarien', 'végé', 'vege', 'végétarisme', 'vegetarisme'],
    'végétarien': ['vegetarien', 'végé', 'vege', 'végétarisme', 'vegetarisme'],
    'info-parents': ['info parents', 'infos-parents', 'info-parent', 'infos parent', 'info-parents'],
    'responsable': ['responsable', 'responsables', 'coordinateur', 'coordinatrice'],
    'activité': ['activite', 'activités', 'activites', 'activity', 'activities'],
  };
  
  let relatedMatches = 0;
  // Cache regex patterns for related terms (optimization)
  const relatedRegexCache = new Map<string, RegExp>();
  for (const word of queryWords) {
    if (relatedTerms[word]) {
      for (const related of relatedTerms[word]) {
        let relatedRegex = relatedRegexCache.get(related);
        if (!relatedRegex) {
          relatedRegex = new RegExp(`\\b${related}\\b`, 'i');
          relatedRegexCache.set(related, relatedRegex);
        }
        if (relatedRegex.test(textLower)) {
          relatedMatches += 1;
          break;
        }
      }
    }
    // Also try fuzzy matching for common typos (directice -> directrice)
    if (word === 'directice' || word === 'directrice') {
      const fuzzyRegex = /directr?ice/i; // This regex is simple, no need to cache
      if (fuzzyRegex.test(textLower)) {
        relatedMatches += 1;
      }
    }
  }
  
  // Check for structured data patterns (lists with names and roles)
  // This gives bonus points if the chunk contains actual personnel/director data
  let structuredDataBonus = 0;
  
  // Check for "projet personnel" pattern - give high priority
  // Also handle typo "project" instead of "projet"
  if (hasProjetPersonnel) {
    // Look for "projet personnel" or "projets personnels" in the text (with typo tolerance)
    const projetPersonnelPattern = /projet\s+personnel|projets\s+personnels|projet\s+personel|projets\s+personels|project\s+personnel|projects\s+personnels/gi;
    const projetMatches = text.match(projetPersonnelPattern);
    if (projetMatches && projetMatches.length > 0) {
      structuredDataBonus += 1.0; // Maximum bonus for "projet personnel" (capped at 1.0 total)
    }
    
    // Additional bonus if chunk starts with or contains "Projet personnel" heading
    if (/^projet\s+personnel|^projets\s+personnels/i.test(textLower.trim()) || 
        /\nprojet\s+personnel|\nprojets\s+personnels/i.test(textLower)) {
      structuredDataBonus += 0.2; // Extra for heading
    }
  }
  
  // Check for schedule/horaire patterns (tables, schedules)
  if (queryLower.includes('horaire') || queryLower.includes('schedule') || queryLower.includes('calendrier') || queryLower.includes('grille-matière')) {
    // Look for schedule-related headings
    if (/calendrier|grille-matière|grille\s+matière|horaire\s+des\s+(examens|cours)/i.test(textLower)) {
      structuredDataBonus += 0.7; // High bonus for schedule sections
    }
    
    // Look for table patterns (rows with times, periods, etc.)
    const tablePattern = /\d+h\d+\s+à\s+\d+h\d+|\d+:\d+\s+à\s+\d+:\d+|période\s+\d+|récréation|dîner|déplacement/i;
    if (tablePattern.test(textLower)) {
      structuredDataBonus += 0.3; // Bonus for table-like content
    }
  }
  
  // Check for activity/responsable patterns (tables with activities)
  // This handles queries about activities like "robotique", "expo science", etc.
  const isActivityQuery = queryLower.includes('responsable') || 
                          queryLower.includes('activité') || 
                          queryLower.includes('activite') ||
                          queryLower.includes('activités') ||
                          queryLower.includes('activites');
  
  if (isActivityQuery) {
    // Common activity names to look for
    const commonActivities = [
      'robotique', 'robotics',
      'bazar vert', 'bazar-vert',
      'expo science', 'expo-science', 'exposcience',
      'improvisation', 'impro',
      'théâtre', 'theatre',
      'journal étudiant', 'journal etudiant',
      'spectacle', 'variétés', 'varietes',
      'coop fab-lab', 'fablab', 'fab-lab',
      'concours math', 'math',
      'entraidants', 'informatiques',
      'école du rock', 'ecole du rock',
      'examen dele', 'dele',
    ];
    
    // Extract activity name from query - look for any activity name mentioned
    let queryActivityName: string | null = null;
    for (const activity of commonActivities) {
      if (queryLower.includes(activity)) {
        queryActivityName = activity;
        break;
      }
    }
    
    // If no known activity found, try to extract any capitalized word that might be an activity
    // (e.g., "robotique" in "activite sur la robotique")
    if (!queryActivityName) {
      const activityMatch = queryLower.match(/\b(robotique|improvisation|théâtre|theatre|spectacle|journal|bazar|expo|science|math|dele|fablab|fab-lab|coop|entraidants|informatiques|rock|variétés|varietes)\b/i);
      if (activityMatch) {
        queryActivityName = activityMatch[1].toLowerCase();
      }
    }
    
    let hasSpecificActivity = false;
    
    if (queryActivityName) {
      // Check if the chunk contains the specific activity name
      // Create flexible regex that handles spaces, hyphens, case variations
      const activityRegex = new RegExp(queryActivityName.replace(/\s+/g, '[\\s-]+'), 'i');
      
      if (activityRegex.test(textLower)) {
        structuredDataBonus += 1.0; // VERY high bonus for matching specific activity name
        hasSpecificActivity = true;
        
        // Extra bonus if activity name appears with a person's name (table structure)
        const activityIndex = textLower.search(activityRegex);
        const contextAround = textLower.substring(
          Math.max(0, activityIndex - 150), 
          Math.min(textLower.length, activityIndex + 300)
        );
        
        // Check for person name pattern near activity (e.g., "Robotique Marcel Laguerre")
        if (/[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+/.test(contextAround)) {
          structuredDataBonus += 0.5; // High bonus for activity + person name (table structure)
        }
        
        // Extra bonus if "responsable" appears near the activity name
        if (/responsable/i.test(contextAround)) {
          structuredDataBonus += 0.4;
        }
        
        // Bonus for time/date patterns near activity (e.g., "Jours 2 le midi de 11h45")
        if (/(?:jours?|jour)\s+\d+|de\s+\d+h\d+|à\s+\d+h\d+/.test(contextAround)) {
          structuredDataBonus += 0.3;
        }
      }
    }
    
    // Only give bonus for generic "activité" if NO specific activity was found
    // This prevents chunks with just "activité" from scoring higher than chunks with the actual activity name
    if (!hasSpecificActivity) {
      // Look for "responsable" + activity pattern (but lower weight)
      if (/responsable.*activité|activité.*responsable/i.test(textLower)) {
        structuredDataBonus += 0.2;
      }
      
      // Look for table-like patterns (but lower weight)
      const activityTablePattern = /(?:bazar|expo|science|vert|robotique|improvisation).*\d{4}[-–]\d{4}/i;
      if (activityTablePattern.test(textLower)) {
        structuredDataBonus += 0.15;
      }
    }
  }
  
  // Check for recipe/ingredient patterns
  if (queryLower.includes('ingrédient') || queryLower.includes('ingredient') || queryLower.includes('recette') || queryLower.includes('recipe')) {
    // Look for ingredient lists (common patterns: numbered lists, bullet points, measurements)
    if (/ingrédients?|ingredients?/i.test(textLower)) {
      structuredDataBonus += 0.6; // High bonus for ingredient sections
    }
    
    // Look for recipe structure (ingredients + preparation)
    if (/ingrédients?.*préparation|ingredients?.*preparation|ingrédients?.*cuisson/i.test(textLower)) {
      structuredDataBonus += 0.4; // Bonus for complete recipe structure
    }
    
    // Look for measurements and quantities (common in recipes)
    if (/\d+\s*(ml|g|kg|tasse|c\.?\s*à\s*soupe|c\.?\s*à\s*thé|oz|cup)/i.test(textLower)) {
      structuredDataBonus += 0.3; // Bonus for recipe measurements
    }
  }
  
  // Check for specific recipe name matches (cari de lentilles, etc.)
  if (queryLower.includes('cari') || queryLower.includes('curry')) {
    if (/cari\s+de\s+lentilles|cari\s+de\s+pommes|curry.*lentil/i.test(textLower)) {
      structuredDataBonus += 1.0; // Maximum bonus for exact recipe match
    }
    if (/lentilles.*pommes|pommes.*lentilles|lentil.*potato/i.test(textLower)) {
      structuredDataBonus += 0.7; // High bonus for recipe components
    }
  }
  
  // Check for Ricardo brand matches
  if (queryLower.includes('ricardo')) {
    if (/ricardo/i.test(textLower)) {
      structuredDataBonus += 0.5; // Bonus for Ricardo brand
    }
  }
  
  // Check for cafeteria/vegetarian patterns
  if (queryLower.includes('cafétéria') || queryLower.includes('cafeteria') || queryLower.includes('végé') || queryLower.includes('vegetarien')) {
    // Look for cafeteria-related content
    if (/cafétéria|cafeteria/i.test(textLower)) {
      structuredDataBonus += 0.4;
    }
    
    // Look for vegetarian options (handle variations)
    if (/végétarien|vegetarien|végétarisme|vegetarisme|végé|vege/i.test(textLower)) {
      structuredDataBonus += 0.5; // High bonus for vegetarian-related content
    }
    
    // Bonus if both cafeteria and vegetarian appear together
    if (/cafétéria.*végétarien|cafeteria.*vegetarien|végétarien.*cafétéria|vegetarien.*cafeteria/i.test(textLower)) {
      structuredDataBonus += 0.3; // Extra bonus for combined match
    }
  }
  
  // Check for Info-parents patterns
  if (queryLower.includes('info-parents') || queryLower.includes('info parents') || queryLower.includes('infos-parents')) {
    // Look for Info-parents heading or content
    if (/info[- ]?parents|infos[- ]?parents/i.test(textLower)) {
      structuredDataBonus += 0.6; // High bonus for Info-parents content
    }
    
    // Look for date patterns near Info-parents (month names in French and English, years)
    const monthPattern = '(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december|\\d{4})';
    if (new RegExp(`info[- ]?parents.*${monthPattern}`, 'i').test(textLower) ||
        new RegExp(`${monthPattern}.*info[- ]?parents`, 'i').test(textLower)) {
      structuredDataBonus += 0.4; // Extra bonus for dates
    }
    
    // Also check if query mentions a specific month/year and match it in text
    const queryMonthMatch = queryLower.match(/(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
    if (queryMonthMatch) {
      const [, month, year] = queryMonthMatch;
      // Check if text contains both the month and year near info-parents
      if (textLower.includes(month.toLowerCase()) && textLower.includes(year) && 
          (textLower.includes('info-parents') || textLower.includes('info parents'))) {
        structuredDataBonus += 0.5; // High bonus for exact month/year match
      }
    }
  }
  
  // Check for director/principal queries - look for name + title patterns
  const isDirectorQuery = queryLower.includes('directrice') || 
                          queryLower.includes('directeur') || 
                          queryLower.includes('directice') ||
                          queryLower.includes('principal');
  
  if (isDirectorQuery && !queryLower.includes('projet personnel')) {
    // Pattern: "Name,\nDirectrice" or "Name, Directrice" or "Name:\nDirectrice" or "Directrice: Name"
    // This is the most important pattern - it contains the actual answer
    const directorPattern = /(?:[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+(?:\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+)*\s*[,:\n\-]\s*(?:directrice|directeur|directice)|(?:directrice|directeur|directice)\s*[,:\n\-]\s*[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+(?:\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+)*)/gi;
    const directorMatches = text.match(directorPattern);
    if (directorMatches && directorMatches.length > 0) {
      // This is the actual answer - give it high score boost
      structuredDataBonus += 0.5; // High bonus for name + title pattern
    }
    
    // Also check for "MOT DE LA DIRECTION" heading (message from director)
    if (/mot\s+de\s+la\s+direction/i.test(textLower)) {
      structuredDataBonus += 0.2;
    }
  }
  
  // Check for personnel/staff patterns - BUT only if NOT asking about "projet personnel"
  if ((queryLower.includes('personnel') || queryLower.includes('personnels')) 
      && !queryLower.includes('projet personnel') && !queryLower.includes('projets personnels')) {
    // Check for name patterns followed by roles (e.g., "Name, role" or "Name: role")
    const nameRolePattern = /[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+(?:\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+)*\s*[,:]\s*(?:conseillère|conseiller|enseignant|enseignante|directrice|directeur|adjoint|adjointe)/gi;
    const matches = text.match(nameRolePattern);
    if (matches && matches.length > 0) {
      structuredDataBonus += Math.min(matches.length * 0.15, 0.5); // Up to 50% bonus
    }
    
    // Also check if "Membres du personnel" heading is present
    if (/membres\s+(du|de la)\s+personnel/i.test(textLower)) {
      structuredDataBonus += 0.2;
    }
  }
  
  // Check for personnel/staff patterns
  if (queryLower.includes('personnel') || queryLower.includes('personnels')) {
    // Check for name patterns followed by roles (e.g., "Name, role" or "Name: role")
    const nameRolePattern = /[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+(?:\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+)*\s*[,:]\s*(?:conseillère|conseiller|enseignant|enseignante|directrice|directeur|adjoint|adjointe)/gi;
    const matches = text.match(nameRolePattern);
    if (matches && matches.length > 0) {
      structuredDataBonus += Math.min(matches.length * 0.15, 0.5); // Up to 50% bonus
    }
    
    // Also check if "Membres du personnel" heading is present
    if (/membres\s+(du|de la)\s+personnel/i.test(textLower)) {
      structuredDataBonus += 0.2;
    }
  }
  
  // Calculate scores with better weighting
  // Prioritize structured data (actual answers) over generic word matches
  
  // Special handling for "projet personnel" queries
  if (isProjetPersonnelQuery) {
    const hasProjetPersonnelInText = /projet\s+personnel|projets\s+personnels|project\s+personnel|projects\s+personnels/i.test(textLower);
    
    if (hasProjetPersonnelInText) {
      // Chunk has "projet personnel" - give it maximum score
      // Still add word score for other matching words (like "élèves", "faire", etc.)
      const wordScore = queryWords.length > 0 
        ? ((exactMatches * 0.8 + partialMatches * 0.2) / Math.max(queryWords.length, 1)) * 0.1
        : 0;
      return Math.min(structuredDataBonus + 0.3 + wordScore, 1.0);
    } else {
      // Chunk doesn't have "projet personnel" - give reduced score but still credit for word matches
      // This ensures "personnel" (staff) queries still work
      const exactPhraseScore = exactPhraseMatch ? 0.2 : 0;
      const keyPhraseScore = keyPhraseMatches > 0 ? Math.min(keyPhraseMatches * 0.15, 0.2) : 0;
      const wordScore = queryWords.length > 0 
        ? ((exactMatches * 0.6 + partialMatches * 0.15) / Math.max(queryWords.length, 1)) * 0.1 // Reduced weight
        : 0;
      const relatedScore = Math.min(relatedMatches * 0.03, 0.03);
      
      // Cap non-"projet personnel" chunks at lower score when query is about "projet personnel"
      return Math.min(structuredDataBonus + exactPhraseScore + keyPhraseScore + wordScore + relatedScore, 0.4);
    }
  }
  
  // Normal scoring for non-"projet personnel" queries
  // ENHANCED: Increased exact phrase match boost from 0.3 to 0.6 for better precision
  const exactPhraseScore = exactPhraseMatch ? 0.6 : 0;
  const keyPhraseScore = keyPhraseMatches > 0 ? Math.min(keyPhraseMatches * 0.25, 0.3) : 0;
  
  // ENHANCED: Add query term position weighting (first words = more important)
  // Words at the start of the query are more important than words at the end
  let weightedExactMatches = 0;
  let weightedPartialMatches = 0;
  const queryWordCount = queryWords.length;
  
  for (let i = 0; i < queryWords.length; i++) {
    const word = queryWords[i];
    const positionWeight = 1.0 + (0.5 * (1 - i / Math.max(queryWordCount, 1))); // First word gets 1.5x, last word gets 1.0x
    
    // Check if this word matched exactly
    const wordBoundaryRegex = getWordBoundaryRegex(word);
    if (wordBoundaryRegex.test(textLower)) {
      weightedExactMatches += positionWeight;
    } else if (textLower.includes(word)) {
      weightedPartialMatches += positionWeight * 0.3;
    }
  }
  
  // ENHANCED: Improved word scoring with position weighting
  const wordScore = queryWords.length > 0 
    ? ((weightedExactMatches * 0.8 + weightedPartialMatches * 0.2) / Math.max(queryWords.length, 1)) * 0.2
    : 0;
  const relatedScore = Math.min(relatedMatches * 0.05, 0.05);
  
  // Structured data bonus is now the most important factor
  const totalScore = structuredDataBonus + exactPhraseScore + keyPhraseScore + wordScore + relatedScore;
  
  return Math.min(totalScore, 1.0); // Cap at 1.0
}

/**
 * Check if query matches appear near the start or end of a chunk
 * Returns: 'start' | 'end' | 'both' | 'middle' | 'none'
 */
function findMatchPosition(query: string, text: string): 'start' | 'end' | 'both' | 'middle' | 'none' {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (queryWords.length === 0) return 'none';
  
  const textLower = text.toLowerCase();
  const boundaryPercent = 0.15; // 15% of chunk length
  const boundaryChars = Math.max(200, Math.floor(text.length * boundaryPercent));
  
  const startSection = textLower.substring(0, boundaryChars);
  const endSection = textLower.substring(Math.max(0, text.length - boundaryChars));
  const middleSection = textLower.substring(boundaryChars, Math.max(boundaryChars, text.length - boundaryChars));
  
  // Count matches in each section
  let startMatches = 0;
  let endMatches = 0;
  let middleMatches = 0;
  
  for (const word of queryWords) {
    if (startSection.includes(word)) startMatches++;
    if (endSection.includes(word)) endMatches++;
    if (middleSection.includes(word)) middleMatches++;
  }
  
  const threshold = Math.max(1, Math.floor(queryWords.length * 0.3)); // 30% of query words
  
  const hasStartMatch = startMatches >= threshold;
  const hasEndMatch = endMatches >= threshold;
  const hasMiddleMatch = middleMatches >= threshold;
  
  if (hasStartMatch && hasEndMatch) return 'both';
  if (hasStartMatch && !hasMiddleMatch) return 'start';
  if (hasEndMatch && !hasMiddleMatch) return 'end';
  if (hasMiddleMatch) return 'middle';
  return 'none';
}

/**
 * Find most relevant chunks for a query
 * Includes neighboring chunks when matches are at boundaries to preserve context
 * @param chunks - Array of text chunks to search
 * @param query - Search query
 * @param maxChunks - Maximum number of chunks to return
 * @param querySubjects - Optional array of subject classifications for the query (e.g., ['staff', 'general'])
 */
export function findRelevantChunks(
  chunks: TextChunk[],
  query: string,
  maxChunks: number = 5,
  querySubjects?: string[]
): ChunkWithScore[] {
  const similarityStartCpu = process.cpuUsage();
  const similarityStartTime = Date.now();
  
  // Filter out CSS/JS chunks before similarity calculation (using shared utility)
  const contentChunks = chunks.filter(chunk => !isNonContentChunk(chunk.source, chunk.text));
  
  // Calculate similarity scores only on content chunks
  const scoredChunks = contentChunks.map((chunk, originalIndex) => {
    let score = calculateSimilarity(query, chunk.text, chunk.source);
    
    // ENHANCED: Classification-based boosting
    // If chunk subject matches query classification, boost the score
    if (querySubjects && querySubjects.length > 0 && chunk.subject) {
      if (querySubjects.includes(chunk.subject)) {
        score += 0.3; // Boost chunks that match the query classification
        console.log(`   📈 Boosted chunk "${chunk.source.split('/').pop()}" (+0.3) for subject match: ${chunk.subject}`);
      }
    }
    
    return {
      chunk,
      originalIndex,
      score,
    };
  });
  
  const similarityTime = Date.now() - similarityStartTime;
  const similarityCpu = process.cpuUsage();
  const userDelta = (similarityCpu.user - similarityStartCpu.user) / 1000;
  const systemDelta = (similarityCpu.system - similarityStartCpu.system) / 1000;
  const totalDelta = userDelta + systemDelta;
  console.log(`   💻 RAG Similarity: ${chunks.length} chunks in ${similarityTime}ms | CPU: ${totalDelta.toFixed(2)}ms (user: ${userDelta.toFixed(2)}ms, system: ${systemDelta.toFixed(2)}ms)`);
  
  // ENHANCED: Document-level scoring - boost chunks from documents with multiple matches
  // If multiple chunks from the same document match, boost all of them
  const documentScores = new Map<string, number>();
  scoredChunks.forEach(item => {
    const source = item.chunk.source;
    const currentDocScore = documentScores.get(source) || 0;
    // Count how many chunks from this document have score > 0.1
    if (item.score > 0.1) {
      documentScores.set(source, currentDocScore + 1);
    }
  });
  
  // Apply document-level boost (0.1 per additional matching chunk from same doc, max 0.3)
  scoredChunks.forEach(item => {
    const source = item.chunk.source;
    const docMatchCount = documentScores.get(source) || 0;
    if (docMatchCount > 1) {
      const docBoost = Math.min((docMatchCount - 1) * 0.1, 0.3);
      item.score += docBoost;
    }
  });
  
  // Sort by score (descending)
  scoredChunks.sort((a, b) => b.score - a.score);
  
  // ENHANCED: Better chunk selection strategy
  // 1. Top 3 highest scoring chunks
  // 2. 2 chunks from different documents (diversity)
  // 3. 1 chunk with high keyword density (even if lower score)
  const selectedChunks: typeof scoredChunks = [];
  const addedSources = new Set<string>();
  const addedChunkKeys = new Set<string>();
  
  // First, add top 3 highest scoring chunks
  for (let i = 0; i < Math.min(3, scoredChunks.length); i++) {
    const item = scoredChunks[i];
    if (item.score > 0) {
      const chunkKey = `${item.chunk.source}:${item.chunk.index}`;
      if (!addedChunkKeys.has(chunkKey)) {
        selectedChunks.push(item);
        addedChunkKeys.add(chunkKey);
        addedSources.add(item.chunk.source);
      }
    }
  }
  
  // Then, add 2 chunks from different documents (diversity)
  let diversityCount = 0;
  for (const item of scoredChunks) {
    if (diversityCount >= 2) break;
    if (item.score > 0 && !addedSources.has(item.chunk.source)) {
      const chunkKey = `${item.chunk.source}:${item.chunk.index}`;
      if (!addedChunkKeys.has(chunkKey)) {
        selectedChunks.push(item);
        addedChunkKeys.add(chunkKey);
        addedSources.add(item.chunk.source);
        diversityCount++;
      }
    }
  }
  
  // Finally, add 1 chunk with high keyword density (even if lower score)
  // Calculate keyword density for remaining chunks
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  for (const item of scoredChunks) {
    if (selectedChunks.length >= maxChunks) break;
    const chunkKey = `${item.chunk.source}:${item.chunk.index}`;
    if (addedChunkKeys.has(chunkKey)) continue;
    
    const textLower = item.chunk.text.toLowerCase();
    let keywordMatches = 0;
    for (const word of queryWords) {
      if (textLower.includes(word)) keywordMatches++;
    }
    const keywordDensity = keywordMatches / Math.max(queryWords.length, 1);
    
    // If keyword density is high (>0.5) and score is reasonable (>0.05), include it
    if (keywordDensity > 0.5 && item.score > 0.05) {
      selectedChunks.push(item);
      addedChunkKeys.add(chunkKey);
      break; // Only add one high-density chunk
    }
  }
  
  // Fill remaining slots with highest scoring chunks
  for (const item of scoredChunks) {
    if (selectedChunks.length >= maxChunks) break;
    const chunkKey = `${item.chunk.source}:${item.chunk.index}`;
    if (!addedChunkKeys.has(chunkKey) && item.score > 0) {
      selectedChunks.push(item);
      addedChunkKeys.add(chunkKey);
    }
  }
  
  // Sort selected chunks by score
  selectedChunks.sort((a, b) => b.score - a.score);
  
  // Get top scoring chunks (use selected chunks instead of simple slice)
  const topChunks = selectedChunks.filter(item => item.score > 0);
  
  // Debug logging for info-parents queries
  if (query.toLowerCase().includes('info-parents') || query.toLowerCase().includes('info parents')) {
    const topScores = scoredChunks.slice(0, 10).map(item => ({
      source: item.chunk.source.split('/').pop() || item.chunk.source,
      score: item.score.toFixed(3),
      hasInfoParents: item.chunk.text.toLowerCase().includes('info-parents') || item.chunk.source.toLowerCase().includes('info-parents'),
      preview: item.chunk.text.substring(0, 100).replace(/\n/g, ' ')
    }));
    console.log(`   🔍 Top 10 scores for "info-parents" query:`, topScores);
    
    // Check if any chunks contain "info-parents" pattern
    const infoParentsChunks = scoredChunks.filter(item => 
      item.chunk.text.toLowerCase().includes('info-parents') || 
      item.chunk.source.toLowerCase().includes('info-parents')
    );
    if (infoParentsChunks.length === 0) {
      console.log(`   ⚠️ WARNING: No chunks found containing "info-parents" pattern in text or source!`);
    } else {
      console.log(`   ✅ Found ${infoParentsChunks.length} chunks containing "info-parents" pattern`);
      const topInfoParents = infoParentsChunks.slice(0, 3).map(item => ({
        source: item.chunk.source.split('/').pop() || item.chunk.source,
        score: item.score.toFixed(3)
      }));
      console.log(`   📊 Top info-parents chunks:`, topInfoParents);
    }
  }
  
  // Special handling for info-parents queries
  const isInfoParentsQuery = query.toLowerCase().includes('info-parents') || query.toLowerCase().includes('info parents');
  
  // For info-parents queries with specific dates, prioritize exact month/year matches
  if (isInfoParentsQuery) {
    const queryLower = query.toLowerCase();
    const monthYearMatch = queryLower.match(/(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
    
    if (monthYearMatch) {
      const [, month, year] = monthYearMatch;
      const monthLower = month.toLowerCase();
      
      // Boost scores for chunks that match the exact month and year
      scoredChunks.forEach(item => {
        const textLower = item.chunk.text.toLowerCase();
        const sourceLower = item.chunk.source.toLowerCase();
        
        // Check if this chunk mentions the exact month and year
        const hasExactMonth = textLower.includes(monthLower) || sourceLower.includes(monthLower);
        const hasExactYear = textLower.includes(year) || sourceLower.includes(year);
        const hasInfoParents = textLower.includes('info-parents') || textLower.includes('info parents') || sourceLower.includes('info-parents');
        
        if (hasExactMonth && hasExactYear && hasInfoParents) {
          // Significant boost for exact match
          item.score += 2.0;
          console.log(`   🎯 Boosted chunk "${item.chunk.source.split('/').pop()}" for exact month/year match: ${month} ${year}`);
        } else if (hasInfoParents && (hasExactMonth || hasExactYear)) {
          // Smaller boost for partial match
          item.score += 0.5;
        }
      });
      
      // Re-sort after boosting
      scoredChunks.sort((a, b) => b.score - a.score);
      
      // Update topChunks after re-sorting
      const newTopChunks = scoredChunks
        .slice(0, maxChunks)
        .filter(item => item.score > 0);
      
      // Replace topChunks if we found better matches
      if (newTopChunks.length > 0 && newTopChunks[0].score > topChunks[0]?.score) {
        topChunks.length = 0;
        topChunks.push(...newTopChunks);
        console.log(`   ✅ Re-ranked chunks after date matching boost`);
      }
    }
  }
  
  // ENHANCED: Final re-ranking after all special handling
  // Re-rank top chunks one more time using refined criteria
  if (topChunks.length > 0) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const finalReranked = topChunks.map(item => {
      const textLower = item.chunk.text.toLowerCase();
      
      // Calculate query term density
      let termMatches = 0;
      for (const word of queryWords) {
        if (textLower.includes(word)) termMatches++;
      }
      const termDensity = termMatches / Math.max(queryWords.length, 1);
      
      // Check match position
      const matchPosition = findMatchPosition(query, item.chunk.text);
      let positionScore = 0;
      if (matchPosition === 'start' || matchPosition === 'both') positionScore = 0.15;
      else if (matchPosition === 'end') positionScore = 0.08;
      
      // Final score: original + term density + position
      const finalScore = item.score + (termDensity * 0.1) + positionScore;
      
      return {
        ...item,
        score: finalScore,
      };
    });
    
    // Sort by final score
    finalReranked.sort((a, b) => b.score - a.score);
    
    // Update topChunks with re-ranked results
    topChunks.length = 0;
    topChunks.push(...finalReranked.slice(0, maxChunks));
  }
  
  if (topChunks.length === 0) {
    // Fallback: return top chunks even with low scores
    console.log(`   ⚠️ No chunks with score > 0, using fallback (top 3 chunks even with low scores)`);
    
    // Special fallback for info-parents queries: look for chunks containing "info-parents" pattern
    if (isInfoParentsQuery) {
      const infoParentsMatches = scoredChunks.filter(item => 
        item.chunk.text.toLowerCase().includes('info-parents') || 
        item.chunk.text.toLowerCase().includes('info parents') ||
        item.chunk.source.toLowerCase().includes('info-parents') ||
        item.chunk.source.toLowerCase().includes('info parents')
      );
      
      if (infoParentsMatches.length > 0) {
        console.log(`   🔍 Info-parents fallback: Found ${infoParentsMatches.length} chunks containing "info-parents" pattern`);
        // Return top 5 info-parents chunks, sorted by score
        return infoParentsMatches
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(item => ({ ...item.chunk, score: item.score }));
      } else {
        console.log(`   ⚠️ Info-parents fallback: No chunks found with "info-parents" pattern`);
      }
    }
    
    return scoredChunks
      .slice(0, Math.min(3, chunks.length))
      .map(item => ({ ...item.chunk, score: item.score }));
  }
  
  // For info-parents queries, enhance results if needed
  if (isInfoParentsQuery) {
    const infoParentsInTop = topChunks.filter(item => 
      item.chunk.text.toLowerCase().includes('info-parents') || 
      item.chunk.text.toLowerCase().includes('info parents')
    ).length;
    
    if (infoParentsInTop === 0) {
      console.log(`   ⚠️ WARNING: Top chunks don't contain "info-parents" pattern, but query does!`);
    }
  }
  
  // Build index of chunks by source and index for neighbor lookup (use filtered chunks)
  const chunkIndex = new Map<string, TextChunk[]>();
  for (const chunk of contentChunks) {
    if (!chunkIndex.has(chunk.source)) {
      chunkIndex.set(chunk.source, []);
    }
    chunkIndex.get(chunk.source)![chunk.index] = chunk;
  }
  
  // Collect result chunks, including neighbors when needed
  const resultChunks: TextChunk[] = [];
  const resultAddedChunkKeys = new Set<string>();
  const resultAddedSources = new Set<string>(); // Track which sources we've added chunks from
  
  // For info-parents queries, prefer to get ALL chunks from matching documents
  if (isInfoParentsQuery) {
    const queryLower = query.toLowerCase();
    const monthYearMatch = queryLower.match(/(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
    
    if (monthYearMatch) {
      const [, month, year] = monthYearMatch;
      const monthLower = month.toLowerCase();
      
      // Find the best matching document (source) that has the exact month/year
      for (const { chunk } of topChunks) {
        const textLower = chunk.text.toLowerCase();
        const hasExactMonth = textLower.includes(monthLower);
        const hasExactYear = textLower.includes(year);
        const hasInfoParents = textLower.includes('info-parents') || textLower.includes('info parents');
        
        if (hasExactMonth && hasExactYear && hasInfoParents && !resultAddedSources.has(chunk.source)) {
          // Add ALL chunks from this document
          const sourceChunks = chunkIndex.get(chunk.source) || [];
          console.log(`   📄 Adding all ${sourceChunks.length} chunks from matching document: ${chunk.source.split('/').pop()}`);
          
          sourceChunks.forEach(sourceChunk => {
            if (sourceChunk) {
              const sourceChunkKey = `${sourceChunk.source}:${sourceChunk.index}`;
              if (!resultAddedChunkKeys.has(sourceChunkKey)) {
                resultChunks.push(sourceChunk);
                resultAddedChunkKeys.add(sourceChunkKey);
              }
            }
          });
          
          resultAddedSources.add(chunk.source);
          
          // Limit to prevent too many chunks
          if (resultChunks.length >= maxChunks * 3) break;
        }
      }
    }
  }
  
  // Add chunks from top matches (if not already added)
  for (const { chunk } of topChunks) {
    const chunkKey = `${chunk.source}:${chunk.index}`;
    if (resultAddedChunkKeys.has(chunkKey)) continue;
    
    // Check if match is at boundary
    const matchPosition = findMatchPosition(query, chunk.text);
    const sourceChunks = chunkIndex.get(chunk.source) || [];
    
    // Add previous chunk if match is at start
    if ((matchPosition === 'start' || matchPosition === 'both') && chunk.index > 0) {
      const prevChunk = sourceChunks[chunk.index - 1];
      if (prevChunk) {
        const prevKey = `${prevChunk.source}:${prevChunk.index}`;
        if (!resultAddedChunkKeys.has(prevKey)) {
          resultChunks.push(prevChunk);
          resultAddedChunkKeys.add(prevKey);
        }
      }
    }
    
    // Add the main chunk
    if (!resultAddedChunkKeys.has(chunkKey)) {
      resultChunks.push(chunk);
      resultAddedChunkKeys.add(chunkKey);
    }
    
    // Add next chunk if match is at end
    if ((matchPosition === 'end' || matchPosition === 'both') && chunk.index < sourceChunks.length - 1) {
      const nextChunk = sourceChunks[chunk.index + 1];
      if (nextChunk) {
        const nextKey = `${nextChunk.source}:${nextChunk.index}`;
        if (!resultAddedChunkKeys.has(nextKey)) {
          resultChunks.push(nextChunk);
          resultAddedChunkKeys.add(nextKey);
        }
      }
    }
    
    // Don't add too many chunks (limit to maxChunks + 3 for context)
    if (resultChunks.length >= maxChunks * 3) break;
  }
  
  // Sort by source and index to maintain reading order
  resultChunks.sort((a, b) => {
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.index - b.index;
  });
  
  // Add scores to result chunks for context building
  const resultWithScores: ChunkWithScore[] = resultChunks.map(chunk => {
    const scoredItem = scoredChunks.find(item => 
      item.chunk.source === chunk.source && item.chunk.index === chunk.index
    );
    return { ...chunk, score: scoredItem?.score || 0 };
  });
  
  return resultWithScores;
}

/**
 * Process documents into chunks
 */
export function processDocuments(documents: Array<{ id: string; content: string; pdfUrl?: string }>): TextChunk[] {
  const allChunks: TextChunk[] = [];
  
  for (const doc of documents) {
    const chunks = chunkText(doc.content);
    chunks.forEach((chunk, index) => {
      allChunks.push({
        text: chunk,
        source: doc.id,
        index,
        pdfUrl: doc.pdfUrl,
      });
    });
  }
  
  return allChunks;
}

/**
 * Build context string from relevant chunks
 * Limits each chunk size to prevent token limit errors
 */
export interface ChunkWithScore extends TextChunk {
  score?: number;
}

/**
 * Intelligently truncate chunk text, keeping sentences with query terms
 */
function intelligentTruncate(text: string, query: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  // Split into sentences (rough heuristic)
  const sentences = text.split(/(?<=[.!?])\s+/);
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  // Score each sentence by number of query terms it contains
  const scoredSentences = sentences.map((sent, idx) => {
    const sentLower = sent.toLowerCase();
    const termCount = queryWords.filter(word => sentLower.includes(word)).length;
    return { sent, idx, termCount };
  });
  
  // Sort by term count (descending), but keep original order for ties
  scoredSentences.sort((a, b) => b.termCount - a.termCount || a.idx - b.idx);
  
  // Take sentences with query terms first, then fill with other sentences
  let truncated = '';
  let charCount = 0;
  const includedIndices = new Set<number>();
  
  // First pass: sentences with query terms
  for (const item of scoredSentences) {
    if (item.termCount > 0 && charCount + item.sent.length <= maxLength) {
      truncated += item.sent + ' ';
      charCount += item.sent.length + 1;
      includedIndices.add(item.idx);
    }
  }
  
  // Second pass: fill remaining space with sentences in original order
  for (let i = 0; i < sentences.length && charCount < maxLength; i++) {
    if (!includedIndices.has(i)) {
      if (charCount + sentences[i].length <= maxLength) {
        truncated += sentences[i] + ' ';
        charCount += sentences[i].length + 1;
      } else {
        break;
      }
    }
  }
  
  return truncated.trim() + '\n\n[Chunk truncated to show most relevant sentences...]';
}

export function buildContextString(chunks: ChunkWithScore[], query?: string): string {
  if (chunks.length === 0) {
    return '';
  }
  
  // Sort chunks by relevance score (highest first)
  const sortedChunks = [...chunks].sort((a, b) => (b.score || 0) - (a.score || 0));
  
  // Limit each chunk to ~300K characters (~75K tokens) to stay within limits
  const MAX_CHUNK_LENGTH = 300000;
  
  // Group chunks by source to find PDF URLs
  // PDF URL might be in any chunk from the same document, so we need to find it
  const pdfUrlsBySource = new Map<string, string>();
  sortedChunks.forEach(chunk => {
    if (chunk.pdfUrl && !pdfUrlsBySource.has(chunk.source)) {
      pdfUrlsBySource.set(chunk.source, chunk.pdfUrl);
    }
  });
  
  // Collect unique PDF URLs
  const pdfUrls = new Set<string>();
  Array.from(pdfUrlsBySource.values()).forEach(url => pdfUrls.add(url));
  
  const contextParts = sortedChunks.map((chunk, index) => {
    // Determine relevance label
    const score = chunk.score || 0;
    let relevanceLabel = 'Low';
    if (score >= 2.0) relevanceLabel = 'High';
    else if (score >= 1.0) relevanceLabel = 'Medium';
    
    // Intelligently truncate if needed
    let chunkText: string;
    if (chunk.text.length > MAX_CHUNK_LENGTH && query) {
      chunkText = intelligentTruncate(chunk.text, query, MAX_CHUNK_LENGTH);
    } else if (chunk.text.length > MAX_CHUNK_LENGTH) {
      chunkText = chunk.text.substring(0, MAX_CHUNK_LENGTH) + '\n\n[Chunk truncated...]';
    } else {
      chunkText = chunk.text;
    }
    
    let contextPart = `[Context ${index + 1} - Relevance: ${relevanceLabel}${score > 0 ? ` (${score.toFixed(2)})` : ''}]\n${chunkText}`;
    
    // Use PDF URL from this chunk, or find it from the same source
    const pdfUrl = chunk.pdfUrl || pdfUrlsBySource.get(chunk.source);
    if (pdfUrl) {
      contextPart += `\n[Source PDF: ${pdfUrl}]`;
    }
    return contextPart;
  });
  
  let context = contextParts.join('\n\n---\n\n');
  
  // Add PDF links section at the end if any exist
  if (pdfUrls.size > 0) {
    context += '\n\n---\n\n[PDF Documents disponibles:]\n';
    Array.from(pdfUrls).forEach((url, idx) => {
      // Extract filename from various URL formats:
      // - file://pdfs/filename.pdf
      // - file://C:/path/to/pdfs/filename.pdf
      // - https://example.com/path/filename.pdf
      let fileName: string;
      if (url.startsWith('file://')) {
        // Remove file:// prefix and extract filename
        const pathPart = url.replace(/^file:\/\/+/, '');
        // Handle both forward and backslashes
        fileName = pathPart.replace(/\\/g, '/').split('/').pop() || url;
      } else if (url.includes('/')) {
        // HTTP/HTTPS URL or other path format
        fileName = url.split('/').pop() || url;
        // Remove query parameters if present
        fileName = fileName.split('?')[0];
      } else {
        fileName = url;
      }
      
      // Ensure filename ends with .pdf and is clean
      if (!fileName.endsWith('.pdf')) {
        // If it doesn't end with .pdf, try to extract from URL
        const pdfMatch = url.match(/([^\/\\]+\.pdf)/i);
        if (pdfMatch) {
          fileName = pdfMatch[1];
        }
      }
      
      // Clean filename (remove any URL encoding or special chars that might cause issues)
      fileName = decodeURIComponent(fileName);
      
      context += `${idx + 1}. ${fileName}\n   Lien de téléchargement: /api/pdf/${encodeURIComponent(fileName)}\n`;
    });
  }
  
  return context;
}



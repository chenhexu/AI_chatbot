import levenshtein from 'fast-levenshtein';

export interface TextChunk {
  text: string;
  source: string;
  index: number;
  pdfUrl?: string; // Original PDF URL/path for PDF text files
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
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  // Penalize CSS/JS/minified files - they're not useful content
  if (source) {
    const sourceLower = source.toLowerCase();
    if (sourceLower.includes('.css') || sourceLower.includes('.js') || 
        sourceLower.includes('.min.') || sourceLower.includes('stylesheet') ||
        sourceLower.includes('block-library') || sourceLower.includes('metaslider')) {
      // Reduce score by 80% for CSS/JS files
      const baseScore = calculateSimilarityInternal(query, text);
      return baseScore * 0.2;
    }
  }
  
  return calculateSimilarityInternal(query, text);
}

function calculateSimilarityInternal(query: string, text: string): number {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  // Remove common French stop words and punctuation
  const stopWords = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'qui', 'que', 'quoi', 'dont', 'où', 'sont', 'est', 'avez', 'a', 'ont', 'son', 'son', 'sont']);
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
    // Exact word match (case-insensitive)
    const wordBoundaryRegex = new RegExp(`\\b${word}\\b`, 'i');
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
  for (const word of queryWords) {
    if (relatedTerms[word]) {
      for (const related of relatedTerms[word]) {
        const relatedRegex = new RegExp(`\\b${related}\\b`, 'i');
        if (relatedRegex.test(textLower)) {
          relatedMatches += 1;
          break;
        }
      }
    }
    // Also try fuzzy matching for common typos (directice -> directrice)
    if (word === 'directice' || word === 'directrice') {
      const fuzzyRegex = /directr?ice/i;
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
    
    // Look for date patterns near Info-parents (month names, years)
    if (/info[- ]?parents.*(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|\d{4})/i.test(textLower) ||
        /(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|\d{4}).*info[- ]?parents/i.test(textLower)) {
      structuredDataBonus += 0.4; // Extra bonus for dates
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
  const exactPhraseScore = exactPhraseMatch ? 0.3 : 0;
  const keyPhraseScore = keyPhraseMatches > 0 ? Math.min(keyPhraseMatches * 0.2, 0.25) : 0;
  const wordScore = queryWords.length > 0 
    ? ((exactMatches * 0.8 + partialMatches * 0.2) / Math.max(queryWords.length, 1)) * 0.15
    : 0;
  const relatedScore = Math.min(relatedMatches * 0.05, 0.05);
  
  // Structured data bonus is now the most important factor
  const totalScore = structuredDataBonus + exactPhraseScore + keyPhraseScore + wordScore + relatedScore;
  
  return Math.min(totalScore, 1.0); // Cap at 1.0
}

/**
 * Find most relevant chunks for a query
 */
export function findRelevantChunks(
  chunks: TextChunk[],
  query: string,
  maxChunks: number = 5  // Increased from 3 to 5 for better coverage
): TextChunk[] {
  // Log the search query (may be expanded with French keywords)
  const queryWords = query.toLowerCase().replace(/[^\w\sàâäéèêëïîôùûüç-]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  console.log(`🔎 RAG search with ${queryWords.length} keywords: ${queryWords.slice(0, 15).join(', ')}${queryWords.length > 15 ? '...' : ''}`);
  
  // Calculate similarity scores
  const scoredChunks = chunks.map(chunk => ({
    chunk,
    score: calculateSimilarity(query, chunk.text, chunk.source),
  }));
  
  // Sort by score (descending)
  scoredChunks.sort((a, b) => b.score - a.score);
  
  // Log top 3 scores for debugging
  console.log(`📊 Top scores: ${scoredChunks.slice(0, 3).map(s => s.score.toFixed(3)).join(', ')}`);
  
  // Return top chunks - be more lenient with the threshold
  // If no chunks have score > 0, return top chunks anyway (might have very low scores)
  const relevantChunks = scoredChunks
    .slice(0, maxChunks)
    .filter(item => item.score > 0 || scoredChunks.length <= maxChunks);
  
  // If we have some chunks with scores, return them
  if (relevantChunks.length > 0) {
    return relevantChunks.map(item => item.chunk);
  }
  
  // Fallback: return top chunks even with low scores if nothing matched
  return scoredChunks
    .slice(0, Math.min(3, chunks.length))
    .map(item => item.chunk);
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
export function buildContextString(chunks: TextChunk[]): string {
  if (chunks.length === 0) {
    return '';
  }
  
  // Limit each chunk to ~300K characters (~75K tokens) to stay within limits
  const MAX_CHUNK_LENGTH = 300000;
  
  // Collect unique PDF URLs
  const pdfUrls = new Set<string>();
  chunks.forEach(chunk => {
    if (chunk.pdfUrl) {
      pdfUrls.add(chunk.pdfUrl);
    }
  });
  
  const contextParts = chunks.map((chunk, index) => {
    const chunkText = chunk.text.length > MAX_CHUNK_LENGTH
      ? chunk.text.substring(0, MAX_CHUNK_LENGTH) + '\n\n[Chunk truncated...]'
      : chunk.text;
    let contextPart = `[Context ${index + 1}]\n${chunkText}`;
    if (chunk.pdfUrl) {
      contextPart += `\n[Source PDF: ${chunk.pdfUrl}]`;
    }
    return contextPart;
  });
  
  let context = contextParts.join('\n\n---\n\n');
  
  // Add PDF links section at the end if any exist
  if (pdfUrls.size > 0) {
    context += '\n\n---\n\n[PDF Documents disponibles:]\n';
    Array.from(pdfUrls).forEach((url, idx) => {
      // Extract filename from file://pdfs/filename.pdf
      const fileName = url.replace('file://', '').split('/').pop() || url;
      context += `${idx + 1}. ${fileName}\n   Lien de téléchargement: /api/pdf/${fileName}\n`;
    });
  }
  
  return context;
}



export interface TextChunk {
  text: string;
  source: string;
  index: number;
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
export function calculateSimilarity(query: string, text: string): number {
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
  
  // Check for activity-related queries (Bazar vert, Expo Science, etc.)
  if (queryLower.includes('responsable') || queryLower.includes('activité') || queryLower.includes('activite')) {
    keyPhrases.push('responsable', 'activité', 'activite', 'activités', 'activites');
  }
  
  // Check for cafeteria/food-related queries
  if (queryLower.includes('cafétéria') || queryLower.includes('cafeteria') || queryLower.includes('végé') || queryLower.includes('vegetarien') || queryLower.includes('végétarien')) {
    keyPhrases.push('cafétéria', 'cafeteria', 'végétarien', 'vegetarien', 'végé', 'vege', 'végétarisme', 'vegetarisme');
  }
  
  // Check for Info-parents queries
  if (queryLower.includes('info-parents') || queryLower.includes('info parents') || queryLower.includes('infos-parents')) {
    keyPhrases.push('info-parents', 'info parents', 'infos-parents', 'info-parent', 'infos parent');
  }
  
  if (queryLower.includes('directrice') || queryLower.includes('directeur') || queryLower.includes('directice')) {
    keyPhrases.push('directrice', 'directeur', 'directice', 'direction', 'mot de la direction');
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
      // Common words get less weight
      if (isCommonWord) {
        exactMatches += 0.3; // Reduced weight for common words
      } else {
        exactMatches++;
      }
    } else {
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
  
  // Check for related terms (French synonyms/related words) with typo tolerance
  const relatedTerms: { [key: string]: string[] } = {
    'personnel': ['personnels', 'membres', 'employés', 'employes', 'staff', 'équipe', 'equipe'],
    'personnels': ['personnel', 'membres', 'employés', 'employes', 'staff', 'équipe', 'equipe'],
    'directrice': ['directeur', 'direction', 'directrice', 'directice'], // Include common typo
    'directice': ['directrice', 'directeur', 'direction'], // Handle typo
    'directeur': ['directrice', 'direction', 'directice'],
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
  if (queryLower.includes('responsable') || queryLower.includes('activité') || queryLower.includes('activite')) {
    // Look for specific activity names in the query (this is the KEY information)
    const activityNames = queryLower.match(/(?:bazar\s+vert|expo\s+science|expo-science|exposcience|bazar\s+vert)/i);
    let hasSpecificActivity = false;
    
    if (activityNames) {
      // Check if the chunk contains the specific activity name
      for (const activity of activityNames) {
        // Create flexible regex that handles spaces, hyphens, case variations
        const activityRegex = new RegExp(activity.replace(/\s+/g, '[\\s-]+').replace(/science/i, 'science'), 'i');
        if (activityRegex.test(textLower)) {
          structuredDataBonus += 1.0; // VERY high bonus for matching specific activity name
          hasSpecificActivity = true;
          
          // Extra bonus if activity name appears with year pattern
          if (/\d{4}[-–]\d{4}/.test(textLower)) {
            structuredDataBonus += 0.3;
          }
          
          // Extra bonus if "responsable" appears near the activity name
          const activityIndex = textLower.search(activityRegex);
          const contextAround = textLower.substring(Math.max(0, activityIndex - 100), Math.min(textLower.length, activityIndex + 200));
          if (/responsable/i.test(contextAround)) {
            structuredDataBonus += 0.4;
          }
        }
      }
    }
    
    // Only give bonus for generic "activité" if NO specific activity was found
    // This prevents chunks with just "activité" from scoring higher than chunks with the actual activity name
    if (!hasSpecificActivity) {
      // Look for "responsable" + activity pattern (but lower weight)
      if (/responsable.*activité|activité.*responsable/i.test(textLower)) {
        structuredDataBonus += 0.2; // Reduced from 0.4
      }
      
      // Look for table-like patterns (but lower weight)
      const activityTablePattern = /(?:bazar|expo|science|vert).*\d{4}[-–]\d{4}/i;
      if (activityTablePattern.test(textLower)) {
        structuredDataBonus += 0.15; // Reduced from 0.3
      }
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
  
  // Check for director/leadership patterns - THIS IS THE KEY MATCH
  // BUT only if NOT asking about "projet personnel" (to avoid false matches)
  if ((queryLower.includes('directrice') || queryLower.includes('directeur') || queryLower.includes('directice')) 
      && !queryLower.includes('projet personnel')) {
    // Pattern: "Name,\nDirectrice" or "Name, Directrice" or "Name:\nDirectrice"
    // This is the most important pattern - it contains the actual answer
    const directorPattern = /[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+(?:\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+)*\s*[,:\n]\s*(?:directrice|directeur|directice)/gi;
    const directorMatches = text.match(directorPattern);
    if (directorMatches && directorMatches.length > 0) {
      // This is the actual answer - give it maximum bonus
      structuredDataBonus += 0.8; // Very high bonus for name + title pattern
      
      // Additional bonus if it's at the start of the chunk (more likely to be the answer)
      const firstMatch = directorMatches[0];
      const matchPosition = text.indexOf(firstMatch);
      const chunkLength = text.length;
      if (matchPosition < chunkLength * 0.2) {
        // If the match is in the first 20% of the chunk, it's likely the main content
        structuredDataBonus += 0.15;
      }
    }
    
    // Also check for "MOT DE LA DIRECTION" heading (message from director)
    // But give less weight than the actual name+title pattern
    if (/mot\s+de\s+la\s+direction/i.test(textLower)) {
      structuredDataBonus += 0.1; // Reduced from 0.2
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
  // Calculate similarity scores
  const scoredChunks = chunks.map(chunk => ({
    chunk,
    score: calculateSimilarity(query, chunk.text),
  }));
  
  // Sort by score (descending)
  scoredChunks.sort((a, b) => b.score - a.score);
  
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
export function processDocuments(documents: Array<{ id: string; content: string }>): TextChunk[] {
  const allChunks: TextChunk[] = [];
  
  for (const doc of documents) {
    const chunks = chunkText(doc.content);
    chunks.forEach((chunk, index) => {
      allChunks.push({
        text: chunk,
        source: doc.id,
        index,
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
  
  return chunks
    .map((chunk, index) => {
      const chunkText = chunk.text.length > MAX_CHUNK_LENGTH
        ? chunk.text.substring(0, MAX_CHUNK_LENGTH) + '\n\n[Chunk truncated...]'
        : chunk.text;
      return `[Context ${index + 1}]\n${chunkText}`;
    })
    .join('\n\n---\n\n');
}



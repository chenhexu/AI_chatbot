import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// Subject categories for school documents
export const SUBJECTS = [
  'general',           // General school info, policies
  'academics',         // Courses, curriculum, grades
  'calendar',          // School calendar, dates, schedules, holidays
  'staff',             // Teachers, principal, administration
  'students',          // Student life, activities, clubs
  'parents',           // Parent information, communications
  'recipes',           // Recipes, cooking, food
  'events',            // School events, activities
  'admissions',        // Enrollment, registration
  'sports',            // Sports, athletics
  'low_confidence',    // Low confidence classifications (to be reviewed)
  'other'              // Everything else
] as const;

export type Subject = typeof SUBJECTS[number];

let geminiClient: GoogleGenerativeAI | null = null;
let openaiClient: OpenAI | null = null;

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

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    // Hardcoded: use OPENAI_API_KEY from env (no check - will throw if not set)
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Get Gemini model name from environment variable, with fallback
 */
function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
}

/**
 * Classify a chunk's subject using GPT-4o-mini (hardcoded, fast, reliable, structured output)
 */
export async function classifyChunkSubject(text: string, signal?: AbortSignal): Promise<Subject> {
  const client = getOpenAIClient();
  const model = 'gpt-4o-mini'; // Hardcoded
  
  // Take first 1000 chars for classification (enough context, still fast)
  const preview = text.substring(0, 1000);
  
  const prompt = `You are an AI classification worker in a batch preprocessing pipeline.
MODEL REQUIREMENTS:
- Use GPT-4o-mini
- Optimize for speed, not creativity
- Assume this task will run hundreds or thousands of times
- Keep outputs short and deterministic
- Do NOT include explanations, markdown, or extra text
TASK:
Classify the given text chunk into exactly ONE category from the list below.
This classification will be used to optimize RAG retrieval performance.
CATEGORIES (choose one only):
- general: General school info, policies, announcements
- academics: Courses, curriculum, grades, academic programs
- calendar: School calendar, dates, schedules, holidays, when school starts/ends
- staff: Teachers, principal, administration, personnel
- students: Student life, activities, clubs, student information
- parents: Parent information, communications, newsletters
- recipes: Recipes, cooking, food, ingredients
- events: School events, activities, special occasions
- admissions: Enrollment, registration, applications
- sports: Sports, athletics, teams
- low_confidence: Low confidence classifications (use when confidence < 0.5)
- other: Everything else
OUTPUT FORMAT (STRICT):
Return ONLY valid JSON with exactly these fields:
{
  "category": "<one of the categories>",
  "confidence": <number between 0.0 and 1.0>
}
RULES:
- Do NOT invent new categories
- If unsure, choose the closest category and lower confidence
- Keep confidence realistic (avoid always using 1.0)
- Do NOT include the input text in the output
- Do NOT add comments or trailing text
INPUT TEXT:
<<<CHUNK>>>
${preview}
<<<CHUNK>>>`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a classification assistant. Return only valid JSON with category and confidence fields.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for deterministic output
      response_format: { type: 'json_object' }
    }, { signal });
    
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.warn('Classification returned empty response, defaulting to "general"');
      return 'general';
    }
    
    // Parse JSON response with better error handling
    let result: { category?: string; confidence?: number } = {};
    let parsed = false;
    
    try {
      // Try direct JSON parse first
      result = JSON.parse(content);
      parsed = true;
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks or other formatting
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch && jsonMatch[0]) {
        try {
          result = JSON.parse(jsonMatch[0]);
          parsed = true;
        } catch (nestedError) {
          console.warn(`Failed to parse JSON from extracted match: ${jsonMatch[0].substring(0, 200)}`);
          console.warn(`Full response: ${content.substring(0, 500)}`);
        }
      } else {
        console.warn(`No JSON object found in response: ${content.substring(0, 200)}`);
      }
    }
    
    if (!parsed) {
      return 'general';
    }
    
    const category = result.category?.trim().toLowerCase();
    const confidence = result.confidence ?? 1.0;
    
    // Validate category
    if (category && SUBJECTS.includes(category as Subject)) {
      // If confidence is low, use low_confidence category instead
      if (confidence < 0.5) {
        console.warn(`Low confidence classification (${confidence}): "${category}" -> "low_confidence" for text: ${preview.substring(0, 100)}...`);
        return 'low_confidence';
      }
      return category as Subject;
    }
    
    // Invalid category, log and fallback
    if (category) {
      console.warn(`Invalid category "${category}", defaulting to "general". Valid categories: ${SUBJECTS.join(', ')}`);
    } else {
      console.warn(`Missing category in response`);
    }
    return 'general';
  } catch (error) {
    if (signal?.aborted) {
      throw new Error('Classification cancelled');
    }
    console.error('Classification error:', error instanceof Error ? error.message : String(error));
    throw error; // Re-throw to be handled by caller
  }
}

/**
 * Keyword-based classification fallback (no API call needed)
 * Used when Gemini quota is exceeded or fails
 */
function classifyQueryByKeywords(query: string): Subject[] {
  const queryLower = query.toLowerCase();
  const categories: Subject[] = [];
  
  // Staff-related keywords
  if (/\b(principal|directeur|directrice|director|teacher|professeur|enseignant|staff|administration|personnel|qui est|who is)\b/i.test(queryLower)) {
    categories.push('staff');
  }
  
  // Calendar/date-related keywords
  if (/\b(quand|when|date|calendar|calendrier|schedule|horaire|début|start|end|fin|rentrée|ouverture|ouvert|opened|fermeture|holiday|vacation|vacances)\b/i.test(queryLower)) {
    categories.push('calendar');
  }
  
  // Code de vie / policies
  if (/\b(code de vie|code of conduct|règlement|rules|policies|politique)\b/i.test(queryLower)) {
    categories.push('general');
  }
  
  // Academic keywords
  if (/\b(cours|course|curriculum|grade|note|exam|examen|academic|académique|matiere|subject)\b/i.test(queryLower)) {
    categories.push('academics');
  }
  
  // Student life
  if (/\b(étudiant|student|activité|activity|club|vie étudiante)\b/i.test(queryLower)) {
    categories.push('students');
  }
  
  // Sports
  if (/\b(sport|athletic|athlétisme|équipe|team)\b/i.test(queryLower)) {
    categories.push('sports');
  }
  
  // Events
  if (/\b(event|événement|celebration|célébration|spectacle|show)\b/i.test(queryLower)) {
    categories.push('events');
  }
  
  // Admissions
  if (/\b(admission|inscription|enrollment|registration|inscrire|apply)\b/i.test(queryLower)) {
    categories.push('admissions');
  }
  
  // Parents
  if (/\b(parent|parental|newsletter|bulletin)\b/i.test(queryLower)) {
    categories.push('parents');
  }
  
  // Recipes
  if (/\b(recipe|recette|cuisine|cooking|food|ingrédient)\b/i.test(queryLower)) {
    categories.push('recipes');
  }
  
  // If no specific categories found, use general + other
  if (categories.length === 0) {
    return ['general', 'other'];
  }
  
  // Always add 'general' as fallback, but keep other specific categories
  if (!categories.includes('general')) {
    categories.push('general');
  }
  
  return categories.slice(0, 3); // Max 3 subjects
}

/**
 * Determine which subject a user query is about (very fast - just query analysis)
 * @param backgroundAI - AI model to use for background processing ('gemini' or 'glm')
 */
export async function classifyQuerySubject(query: string, backgroundAI: 'gemini' | 'glm' = 'gemini'): Promise<Subject[]> {
  // First try keyword-based classification (fast, no API call)
  const keywordResult = classifyQueryByKeywords(query);
  
  // If keyword classification found specific categories (not just general+other), use it
  // This provides a good fallback when Gemini quota is exceeded
  const hasSpecificCategory = keywordResult.some(c => c !== 'general' && c !== 'other');
  
  // Try AI classification (Gemini or GLM), but fall back to keywords if it fails
  let useGLM = false;
  let client: any = null;
  let model: any = null;
  
  if (backgroundAI === 'glm') {
    try {
      const { getGLMClient, getGLMModel } = await import('./openai');
      client = getGLMClient();
      const modelName = getGLMModel();
      useGLM = true;
      console.log(`🤖 [AI CALL] GLM-4.7 (${modelName}) - Classification`);
    } catch (error) {
      console.warn('GLM client not available, falling back to Gemini:', error);
      // Fall back to Gemini
      client = getGeminiClient();
      model = client.getGenerativeModel({ model: getGeminiModel() });
    }
  } else {
    client = getGeminiClient();
    model = client.getGenerativeModel({ model: getGeminiModel() });
  }
  
  const prompt = `A user asked: "${query}"

Which of these document categories might contain the answer? Choose 1-3 most relevant categories:

IMPORTANT RULES:
- staff: Use for questions about principal, director, teachers, administration, personnel, staff members, "qui est" (who is) questions about people
- calendar: Use for dates, schedules, when school starts/ends/opens, "quand" (when) questions about dates
- general: Use for school policies, codes of conduct ("code de vie"), general information about the school
- academics: Courses, curriculum, grades
- students: Student life, activities
- parents: Parent information
- recipes: Recipes, cooking, food
- events: School events
- admissions: Enrollment, registration
- sports: Sports, athletics
- low_confidence: Low confidence classifications (to be reviewed)
- other: Everything else

Be specific: If asking about "principal" or "directeur", choose "staff", not "general".
If asking about "code de vie" or school rules, choose "general".

Respond with ONLY the category names separated by commas, nothing else. Example: "staff,general" or "calendar,general"`;

  try {
    if (useGLM && client) {
      // Use GLM-4.7 (OpenAI-compatible)
      const { getGLMModel } = await import('./openai');
      const modelName = getGLMModel();
      console.log(`🤖 [AI CALL] GLM-4.7 (${modelName}) - Classification`);
      console.log(`   Input: "${query}"`);
      
      const response = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: 'You are a classification assistant. Return only category names separated by commas.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 50,
      });
      
      const responseText = response.choices[0]?.message?.content?.trim() || '';
    let categories = responseText
      .trim()
      .toLowerCase()
      .split(',')
      .map((c: string) => c.trim())
      .filter((c: string) => SUBJECTS.includes(c as Subject))
      .map((c: string) => c as Subject);
    
    // Filter out 'low_confidence' - don't search in low confidence chunks
    categories = categories.filter((c: Subject) => c !== 'low_confidence');
      
      // Always include 'general' as fallback, and 'other' if nothing matches
      if (categories.length === 0) {
        console.log(`   Response: (empty - using keyword fallback)`);
        console.log(`🔍 Classification method: Keyword-based (GLM-4.7 returned empty, using keyword fallback)`);
        return keywordResult; // Use keyword fallback instead of generic fallback
      }
      
      // Add 'general' as fallback if not already included
      if (!categories.includes('general')) {
        categories.push('general');
      }
      
      console.log(`   Response: ${categories.join(', ')}`);
      console.log(`🔍 Classification method: GLM-4.7 AI (${categories.join(', ')})`);
      return categories.slice(0, 3); // Max 3 subjects
    } else {
      // Use Gemini
      const modelName = getGeminiModel();
      console.log(`🤖 [AI CALL] Gemini (${modelName}) - Classification`);
      console.log(`   Input: "${query}"`);
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      let categories = responseText
        .trim()
        .toLowerCase()
        .split(',')
        .map((c: string) => c.trim())
        .filter((c: string) => SUBJECTS.includes(c as Subject))
        .map((c: string) => c as Subject);
      
      // Filter out 'low_confidence' - don't search in low confidence chunks
      categories = categories.filter((c: Subject) => c !== 'low_confidence');
      
      // Always include 'general' as fallback, and 'other' if nothing matches
      if (categories.length === 0) {
        console.log(`   Response: (empty - using keyword fallback)`);
        console.log(`🔍 Classification method: Keyword-based (Gemini returned empty, using keyword fallback)`);
        return keywordResult; // Use keyword fallback instead of generic fallback
      }
      
      // Add 'general' as fallback if not already included
      if (!categories.includes('general')) {
        categories.push('general');
      }
      
      console.log(`   Response: ${categories.join(', ')}`);
      console.log(`🔍 Classification method: Gemini AI (${categories.join(', ')})`);
      return categories.slice(0, 3); // Max 3 subjects
    }
  } catch (error) {
    // AI failed (quota, network, etc.) - use keyword-based classification
    const aiName = useGLM ? 'GLM-4.7' : 'Gemini';
    console.log(`🔍 Classification method: Keyword-based (${aiName} failed: ${error instanceof Error ? error.message.substring(0, 100) : String(error).substring(0, 100)})`);
    
    // If GLM failed, try Gemini as fallback
    if (useGLM && backgroundAI === 'glm') {
      try {
        console.log(`🔄 Trying Gemini as fallback for classification...`);
        const geminiClient = getGeminiClient();
        const geminiModel = geminiClient.getGenerativeModel({ model: getGeminiModel() });
        const result = await geminiModel.generateContent(prompt);
        const responseText = result.response.text();
        let categories = responseText
          .trim()
          .toLowerCase()
          .split(',')
          .map(c => c.trim())
          .filter(c => SUBJECTS.includes(c as Subject))
          .map(c => c as Subject);
        categories = categories.filter(c => c !== 'low_confidence');
        if (categories.length === 0) return keywordResult;
        if (!categories.includes('general')) categories.push('general');
        console.log(`🔍 Classification method: Gemini AI (fallback, ${categories.join(', ')})`);
        return categories.slice(0, 3);
      } catch (fallbackError) {
        console.log(`⚠️ Gemini fallback also failed, using keyword-based classification`);
      }
    }
    
    return keywordResult; // Return keyword-based result
  }
}


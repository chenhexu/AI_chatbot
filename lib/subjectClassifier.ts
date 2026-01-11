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
      // Log low-confidence classifications for review
      if (confidence < 0.5) {
        console.warn(`Low confidence classification (${confidence}): "${category}" for text: ${preview.substring(0, 100)}...`);
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
 * Determine which subject a user query is about (very fast - just query analysis)
 */
export async function classifyQuerySubject(query: string): Promise<Subject[]> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: getGeminiModel() });
  
  const prompt = `A user asked: "${query}"

Which of these document categories might contain the answer? Choose 1-3 most relevant:
- general: General school info, policies
- academics: Courses, curriculum, grades
- calendar: School calendar, dates, schedules, when school starts/ends
- staff: Teachers, principal, administration
- students: Student life, activities
- parents: Parent information
- recipes: Recipes, cooking, food
- events: School events
- admissions: Enrollment, registration
- sports: Sports, athletics
- other: Everything else

Respond with ONLY the category names separated by commas, nothing else. Example: "calendar,general"`;

  try {
    const result = await model.generateContent(prompt);
    const categories = result.response.text()
      .trim()
      .toLowerCase()
      .split(',')
      .map(c => c.trim())
      .filter(c => SUBJECTS.includes(c as Subject))
      .map(c => c as Subject);
    
    // Always include 'general' as fallback, and 'other' if nothing matches
    if (categories.length === 0) {
      return ['general', 'other'];
    }
    
    // Add 'general' as fallback if not already included
    if (!categories.includes('general')) {
      categories.push('general');
    }
    
    return categories.slice(0, 3); // Max 3 subjects
  } catch (error) {
    console.error('Query classification error:', error);
    return ['general', 'other']; // Fallback to search all
  }
}


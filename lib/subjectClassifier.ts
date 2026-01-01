import { GoogleGenerativeAI } from '@google/generative-ai';

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

/**
 * Get Gemini model name from environment variable, with fallback
 */
function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
}

/**
 * Classify a chunk's subject using Gemini (fast, free)
 */
export async function classifyChunkSubject(text: string): Promise<Subject> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: getGeminiModel() });
  
  // Take first 500 chars for classification (fast)
  const preview = text.substring(0, 500);
  
  const prompt = `Classify this school document text into ONE of these categories:
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

Text: "${preview}"

Respond with ONLY the category name, nothing else.`;

  try {
    const result = await model.generateContent(prompt);
    const category = result.response.text().trim().toLowerCase();
    
    // Validate and return
    if (SUBJECTS.includes(category as Subject)) {
      return category as Subject;
    }
    return 'other';
  } catch (error) {
    console.error('Classification error:', error);
    return 'other';
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



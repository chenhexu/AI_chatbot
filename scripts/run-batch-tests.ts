#!/usr/bin/env tsx
/**
 * Batch test script - runs multiple questions and generates a report
 * 
 * Usage:
 *   npm run batch-test
 *   npm run batch-test -- --provider gemini --gemini-model gemini-2.5-flash
 *   npm run batch-test -- --provider openai --background-ai gemini
 *   npm run batch-test -- --background-ai gemini --gemini-model gemini-2.5-flash
 *   npm run batch-test -- --questions scripts/test-questions.json
 * 
 * Gemini Models:
 *   - gemini-2.5-flash (default, has availability)
 *   - gemini-3-flash (fully available)
 *   - gemini-2.5-flash-lite (exhausted)
 * 
 * Note: Gemma models are not available through the Gemini API.
 */

// Load environment variables
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

import { loadAllChunks } from '../lib/database/documentStore';
import { generateChatResponse } from '../lib/openai';
import { classifyQuerySubject } from '../lib/subjectClassifier';
import { expandAndTranslateQuery } from '../lib/queryExpander';
import { detectLanguage } from '../lib/utils/filters';

interface TestQuestion {
  category: string;
  language: string;
  questions: string[];
}

interface TestResult {
  question: string;
  category: string;
  language: string;
  provider: string;
  backgroundAI: string;
  providerModel: string;
  backgroundModel: string;
  timeTaken: number;
  response: string;
  success: boolean;
  error?: string;
}

/**
 * Process a single query and return result
 */
async function processQuery(
  question: string,
  provider: 'openai' | 'gemini' | 'glm' | 'ollama',
  backgroundAI: 'gemini' | 'glm'
): Promise<{ response: string; timeTaken: number; providerModel: string; backgroundModel: string; error?: string }> {
  const startTime = Date.now();
  let providerModel = '';
  let backgroundModel = '';
  
  try {
    // Get model names
    if (provider === 'openai') {
      providerModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    } else if (provider === 'gemini') {
      const { getGeminiModel } = await import('../lib/openai');
      providerModel = getGeminiModel();
    } else if (provider === 'glm') {
      const { getGLMModel } = await import('../lib/openai');
      providerModel = getGLMModel();
    } else if (provider === 'ollama') {
      const { getOllamaModel } = await import('../lib/openai');
      providerModel = getOllamaModel();
    }
    
    if (backgroundAI === 'gemini') {
      const { getGeminiModel } = await import('../lib/openai');
      backgroundModel = getGeminiModel();
    } else if (backgroundAI === 'glm') {
      const { getGLMModel } = await import('../lib/openai');
      backgroundModel = getGLMModel();
    }
    
    // Classify query
    const querySubjects = await classifyQuerySubject(question, backgroundAI);
    
    // Load chunks
    let chunks;
    if (querySubjects.length > 0) {
      chunks = await loadAllChunks(querySubjects);
      if (chunks.length === 0) {
        chunks = await loadAllChunks();
      }
    } else {
      chunks = await loadAllChunks();
    }
    
    // Expand query
    const expandedQuery = await expandAndTranslateQuery(question, backgroundAI);
    
    // Generate response
    const response = await generateChatResponse(question, chunks, undefined, provider, expandedQuery);
    
    const timeTaken = Date.now() - startTime;
    
    // Check if response indicates failure
    const errorMessages = [
      "i cannot answer this question",
      "je ne peux pas répondre",
      "i don't have",
      "je n'ai pas",
      "contact the school",
      "contacter l'école",
      "could you rephrase",
      "pourriez-vous reformuler",
      "sorry, i couldn't generate",
      "désolé, je n'ai pas pu générer",
      "please try again",
      "veuillez réessayer",
      "couldn't generate a response",
      "n'ai pas pu générer de réponse"
    ];
    
    const responseLower = response.toLowerCase().trim();
    const isError = errorMessages.some(msg => responseLower.includes(msg));
    
    // Also check if response is too short (likely an error)
    const isTooShort = response.length < 30;
    
    // Check if response is just an error message (no actual content)
    const isJustError = (responseLower.includes("sorry") && (responseLower.includes("try again") || responseLower.includes("couldn't generate"))) ||
                       (responseLower.includes("désolé") && (responseLower.includes("réessayer") || responseLower.includes("pas pu générer")));
    
    // Additional check: if response contains only error phrases and nothing else
    const hasOnlyErrorPhrases = (responseLower.includes("sorry") || responseLower.includes("désolé")) && 
                                (responseLower.includes("couldn't") || responseLower.includes("pas pu")) &&
                                response.length < 100; // Short responses with error phrases are likely errors
    
    const hasError = isError || isTooShort || isJustError || hasOnlyErrorPhrases;
    
    return {
      response,
      timeTaken,
      providerModel,
      backgroundModel,
      error: hasError ? 'No information found or response too short' : undefined
    };
  } catch (error) {
    const timeTaken = Date.now() - startTime;
    return {
      response: '',
      timeTaken,
      providerModel,
      backgroundModel,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Load questions from JSON file
 */
function loadQuestions(filePath: string): Array<{ question: string; category: string; language: string }> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  // Flatten the structure
  const allQuestions: Array<{ question: string; category: string; language: string }> = [];
  data.forEach((category: any) => {
    category.questions.forEach((q: string) => {
      // Detect language if not specified
      const detectedLang = detectLanguage(q);
      const language = category.language || detectedLang;
      
      allQuestions.push({
        question: q,
        category: category.category,
        language: language
      });
    });
  });
  
  return allQuestions;
}

/**
 * Generate report
 */
function generateReport(results: TestResult[]): string {
  const frenchResults = results.filter(r => r.language === 'fr');
  const englishResults = results.filter(r => r.language === 'en');
  
  const frenchSuccess = frenchResults.filter(r => r.success).length;
  const frenchTotal = frenchResults.length;
  const frenchRate = frenchTotal > 0 ? ((frenchSuccess / frenchTotal) * 100).toFixed(1) : '0.0';
  
  const englishSuccess = englishResults.filter(r => r.success).length;
  const englishTotal = englishResults.length;
  const englishRate = englishTotal > 0 ? ((englishSuccess / englishTotal) * 100).toFixed(1) : '0.0';
  
  const totalSuccess = results.filter(r => r.success).length;
  const totalRate = ((totalSuccess / results.length) * 100).toFixed(1);
  
  let report = '\n' + '='.repeat(80) + '\n';
  report += 'BATCH TEST REPORT\n';
  report += '='.repeat(80) + '\n\n';
  
  report += `Total Questions: ${results.length}\n`;
  report += `Total Success: ${totalSuccess} (${totalRate}%)\n`;
  report += `Total Failed: ${results.length - totalSuccess} (${(100 - parseFloat(totalRate)).toFixed(1)}%)\n\n`;
  
  report += '='.repeat(80) + '\n';
  report += 'FRENCH QUESTIONS\n';
  report += '='.repeat(80) + '\n';
  report += `Total: ${frenchTotal}\n`;
  report += `Success: ${frenchSuccess} (${frenchRate}%)\n`;
  report += `Failed: ${frenchTotal - frenchSuccess} (${(100 - parseFloat(frenchRate)).toFixed(1)}%)\n\n`;
  
  if (frenchResults.filter(r => !r.success).length > 0) {
    report += 'Failed Questions:\n';
    frenchResults.filter(r => !r.success).forEach(r => {
      report += `  - [${r.category}] ${r.question}\n`;
      if (r.error) report += `    Error: ${r.error}\n`;
    });
    report += '\n';
  }
  
  report += '='.repeat(80) + '\n';
  report += 'ENGLISH QUESTIONS\n';
  report += '='.repeat(80) + '\n';
  report += `Total: ${englishTotal}\n`;
  report += `Success: ${englishSuccess} (${englishRate}%)\n`;
  report += `Failed: ${englishTotal - englishSuccess} (${(100 - parseFloat(englishRate)).toFixed(1)}%)\n\n`;
  
  if (englishResults.filter(r => !r.success).length > 0) {
    report += 'Failed Questions:\n';
    englishResults.filter(r => !r.success).forEach(r => {
      report += `  - [${r.category}] ${r.question}\n`;
      if (r.error) report += `    Error: ${r.error}\n`;
    });
    report += '\n';
  }
  
  // Category breakdown
  report += '='.repeat(80) + '\n';
  report += 'CATEGORY BREAKDOWN\n';
  report += '='.repeat(80) + '\n';
  
  const categories = new Set(results.map(r => r.category));
  categories.forEach(category => {
    const categoryResults = results.filter(r => r.category === category);
    const categorySuccess = categoryResults.filter(r => r.success).length;
    const categoryRate = ((categorySuccess / categoryResults.length) * 100).toFixed(1);
    report += `${category}: ${categorySuccess}/${categoryResults.length} (${categoryRate}%)\n`;
  });
  
  report += '\n';
  
  // Provider breakdown
  report += '='.repeat(80) + '\n';
  report += 'PROVIDER BREAKDOWN\n';
  report += '='.repeat(80) + '\n';
  
  const providers = new Set(results.map(r => `${r.provider} (${r.providerModel})`));
  providers.forEach(provider => {
    const providerResults = results.filter(r => `${r.provider} (${r.providerModel})` === provider);
    const providerSuccess = providerResults.filter(r => r.success).length;
    const providerRate = ((providerSuccess / providerResults.length) * 100).toFixed(1);
    const avgTime = (providerResults.reduce((sum, r) => sum + r.timeTaken, 0) / providerResults.length).toFixed(0);
    report += `${provider}: ${providerSuccess}/${providerResults.length} (${providerRate}%) | Avg Time: ${avgTime}ms\n`;
  });
  
  report += '\n';
  
  // Summary of failed questions only
  report += '='.repeat(80) + '\n';
  report += 'FAILED QUESTIONS SUMMARY\n';
  report += '='.repeat(80) + '\n\n';
  
  const failedResults = results.filter(r => !r.success);
  if (failedResults.length > 0) {
    failedResults.forEach((result, index) => {
      report += `${index + 1}. [${result.language.toUpperCase()}] [${result.category}] ${result.question}\n`;
      report += `   Provider: ${result.provider} (${result.providerModel}), Background: ${result.backgroundAI} (${result.backgroundModel})\n`;
      report += `   Time: ${result.timeTaken}ms\n`;
      if (result.error) {
        report += `   Error: ${result.error}\n`;
      }
      report += `   Response Preview: ${result.response.substring(0, 150)}${result.response.length > 150 ? '...' : ''}\n`;
      report += '\n';
    });
  } else {
    report += '✅ All questions passed!\n\n';
  }
  
  return report;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  let provider: 'openai' | 'gemini' | 'glm' | 'ollama' = 'glm';
  let backgroundAI: 'gemini' | 'glm' = 'glm';
  let geminiModel: string | null = null;
  let questionsFile = path.join(process.cwd(), 'scripts', 'test-questions.json');
  
  // Parse arguments - handle npm's -- separator
  // When using npm run, arguments after -- are passed to the script
  const argIndex = args.indexOf('--');
  const actualArgs = argIndex >= 0 ? args.slice(argIndex + 1) : args;
  
  console.log(`🔍 Parsing arguments: ${JSON.stringify(actualArgs)}`);
  
  // Handle case where npm passes values without flags (PowerShell/npm quirk)
  if (actualArgs.length >= 1 && !actualArgs[0].startsWith('--')) {
    if (actualArgs[0] && (actualArgs[0] === 'openai' || actualArgs[0] === 'gemini' || actualArgs[0] === 'glm' || actualArgs[0] === 'ollama')) {
      provider = actualArgs[0] as 'openai' | 'gemini' | 'glm' | 'ollama';
      console.log(`✅ Provider set to: ${provider} (positional)`);
    }
    if (actualArgs[1] && (actualArgs[1] === 'gemini' || actualArgs[1] === 'glm')) {
      backgroundAI = actualArgs[1] as 'gemini' | 'glm';
      console.log(`✅ Background AI set to: ${backgroundAI} (positional)`);
    }
    if (actualArgs[2] && (actualArgs[2].includes('gemma') || actualArgs[2].includes('gemini'))) {
      geminiModel = actualArgs[2];
      process.env.GEMINI_MODEL = geminiModel;
      console.log(`✅ Gemini model set to: ${geminiModel} (positional)`);
    }
  } else {
    for (let i = 0; i < actualArgs.length; i++) {
      if (actualArgs[i] === '--provider' && i + 1 < actualArgs.length) {
        const p = actualArgs[i + 1].toLowerCase();
        if (p === 'openai' || p === 'gemini' || p === 'glm' || p === 'ollama') {
          provider = p as 'openai' | 'gemini' | 'glm' | 'ollama';
          console.log(`✅ Provider set to: ${provider}`);
        }
        i++;
      } else if (actualArgs[i] === '--background-ai' && i + 1 < actualArgs.length) {
        const b = actualArgs[i + 1].toLowerCase();
        if (b === 'gemini' || b === 'glm') {
          backgroundAI = b as 'gemini' | 'glm';
          console.log(`✅ Background AI set to: ${backgroundAI}`);
        }
        i++;
      } else if (actualArgs[i] === '--gemini-model' && i + 1 < actualArgs.length) {
        geminiModel = actualArgs[i + 1];
        process.env.GEMINI_MODEL = geminiModel;
        console.log(`✅ Gemini model set to: ${geminiModel}`);
        i++;
      } else if (actualArgs[i] === '--questions' && i + 1 < actualArgs.length) {
        questionsFile = actualArgs[i + 1];
        i++;
      }
    }
  }
  
  // Check database
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable not set');
    process.exit(1);
  }
  
  console.log('🔌 Connecting to database...');
  try {
    const testChunks = await loadAllChunks();
    console.log(`✅ Connected! Found ${testChunks.length} chunks in database\n`);
  } catch (error) {
    console.error('❌ Error connecting to database:', error);
    process.exit(1);
  }
  
  // Load questions
  console.log(`📋 Loading questions from ${questionsFile}...`);
  const allQuestions = loadQuestions(questionsFile);
  
  console.log(`✅ Loaded ${allQuestions.length} questions\n`);
  console.log(`🤖 Running tests with:`);
  const providerName = provider === 'glm' ? 'GLM-4.7' : 
                       provider === 'gemini' ? (geminiModel || 'Gemini') : 
                       provider === 'ollama' ? (process.env.OLLAMA_MODEL || 'Ollama (gemma3:12b)') :
                       'OpenAI';
  const backgroundName = backgroundAI === 'glm' ? 'GLM-4.7' : 
                        (geminiModel || 'Gemini');
  console.log(`   Response Provider: ${provider.toUpperCase()} (${providerName})`);
  console.log(`   Background AI: ${backgroundAI.toUpperCase()} (${backgroundName})\n`);
  console.log('='.repeat(80) + '\n');
  console.log('💡 Tip: Press Ctrl+C to generate a summary report with current results\n');
  
  // Run tests
  const results: TestResult[] = [];
  let interrupted = false;
  
  // Function to generate and save report
  const saveReport = (isInterrupted: boolean = false) => {
    if (results.length === 0) {
      console.log('\n⚠️  No results to report yet.\n');
      return;
    }
    
    const report = generateReport(results);
    const reportFile = path.join(process.cwd(), 'scripts', `test-report-${Date.now()}.txt`);
    fs.writeFileSync(reportFile, report);
    
    if (isInterrupted) {
      console.log('\n\n⚠️  Test interrupted by user (Ctrl+C)');
      console.log(`📊 Generating summary report with ${results.length} completed tests...\n`);
    }
    
    console.log(report);
    console.log(`\n📄 Full report saved to: ${reportFile}\n`);
  };
  
  // Handle Ctrl+C (SIGINT) - generate summary before exiting
  process.on('SIGINT', () => {
    interrupted = true;
    console.log('\n\n🛑 Interrupt received...');
    saveReport(true);
    process.exit(0);
  });
  
  for (let i = 0; i < allQuestions.length; i++) {
    if (interrupted) break;
    const { question, category, language } = allQuestions[i];
    
    // Suppress console.log during query processing
    const originalLog = console.log;
    console.log = () => {};
    
    const result = await processQuery(question, provider, backgroundAI);
    
    // Restore console.log
    console.log = originalLog;
    
    const testResult: TestResult = {
      question,
      category,
      language,
      provider,
      backgroundAI,
      providerModel: result.providerModel,
      backgroundModel: result.backgroundModel,
      timeTaken: result.timeTaken,
      response: result.response,
      success: !result.error && result.response.length > 0,
      error: result.error
    };
    
    results.push(testResult);
    
    // Print simplified output
    console.log(`\n=================================================`);
    console.log(`Provider model: ${result.providerModel}`);
    console.log(`Background model: ${result.backgroundModel}`);
    console.log(`Question: ${question}`);
    console.log(`Response: ${result.response}`);
    console.log(`${testResult.success ? 'Success' : 'Fail'}`);
    console.log(`Response time: ${(result.timeTaken / 1000).toFixed(2)} s`);
    console.log(`=================================================\n`);
  }
  
  if (!interrupted) {
    saveReport(false);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

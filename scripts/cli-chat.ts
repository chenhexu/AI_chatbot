#!/usr/bin/env tsx
/**
 * CLI tool for testing chatbot queries locally
 * 
 * Usage:
 *   npm run cli-chat "your query here"
 *   npm run cli-chat                    # Interactive mode
 *   npm run cli-chat -- --provider gemini
 *   npm run cli-chat -- --background-ai glm
 * 
 * Environment:
 *   - Uses DATABASE_URL from .env.local file
 *   - Uses OPENAI_API_KEY, GEMINI_API_KEY, GLM_API_KEY from .env.local
 */

// Load environment variables from .env.local or .env
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Try .env.local first, then .env
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
  console.log('📄 Loaded environment from .env.local');
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('📄 Loaded environment from .env');
} else {
  console.warn('⚠️  No .env.local or .env file found. Using system environment variables only.');
}

import * as readline from 'readline';
import { loadAllChunks } from '../lib/database/documentStore';
import { generateChatResponse } from '../lib/openai';
import { classifyQuerySubject } from '../lib/subjectClassifier';
import { expandAndTranslateQuery } from '../lib/queryExpander';
import os from 'os';

// Track CPU usage
function logCpuUsage(requestId: string, label: string, startCpu?: NodeJS.CpuUsage): NodeJS.CpuUsage {
  const currentCpu = process.cpuUsage();
  const cpus = os.cpus();
  const numCores = cpus.length;
  
  if (startCpu) {
    const userDelta = (currentCpu.user - startCpu.user) / 1000;
    const systemDelta = (currentCpu.system - startCpu.system) / 1000;
    const totalDelta = userDelta + systemDelta;
    console.log(`[${requestId}] 💻 CPU [${label}]: ${totalDelta.toFixed(2)}ms (user: ${userDelta.toFixed(2)}ms, system: ${systemDelta.toFixed(2)}ms) | Cores: ${numCores}`);
  } else {
    const totalMs = (currentCpu.user + currentCpu.system) / 1000;
    console.log(`[${requestId}] 💻 CPU [${label}]: ${totalMs.toFixed(2)}ms total | Cores: ${numCores}`);
  }
  
  return currentCpu;
}

/**
 * Process a single query
 */
async function processQuery(
  message: string,
  provider: 'openai' | 'gemini' | 'glm' = 'openai',
  backgroundAI: 'gemini' | 'glm' = 'gemini'
): Promise<string> {
  const requestId = Math.random().toString(36).substring(2, 8);
  const requestStartCpu = process.cpuUsage();
  const requestStartTime = Date.now();

  try {
    // Print separator
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${requestId}] 📨 Query: "${message}"`);
    console.log(`[${requestId}] 🤖 Provider: ${provider}, Background AI: ${backgroundAI}`);
    logCpuUsage(requestId, 'Request Start');

    // Step 1: Classify query subject
    const enableSubjectFilter = process.env.ENABLE_SUBJECT_FILTER !== 'false';
    let querySubjects: string[] = [];
    
    if (enableSubjectFilter) {
      const subjectStartCpu = process.cpuUsage();
      console.log(`[${requestId}] 🧠 Classifying query subject...`);
      console.log(`[${requestId}] 📝 Original query: "${message}"`);
      try {
        querySubjects = await classifyQuerySubject(message, backgroundAI);
        logCpuUsage(requestId, 'Subject Classification', subjectStartCpu);
        console.log(`[${requestId}] ✅ Query subjects classified: [${querySubjects.join(', ')}]`);
        console.log(`[${requestId}] 📊 Classification details: ${querySubjects.length} subject(s) identified`);
      } catch (error) {
        logCpuUsage(requestId, 'Subject Classification (failed)', subjectStartCpu);
        console.error(`[${requestId}] ⚠️ Subject classification failed, using all chunks:`, error);
        querySubjects = [];
      }
    } else {
      console.log(`[${requestId}] ⏭️ Subject classification disabled (ENABLE_SUBJECT_FILTER=false), using all chunks`);
    }

    // Step 2: Expand and translate query
    const expandStartCpu = process.cpuUsage();
    let expandedQuery = message;
    try {
      expandedQuery = await expandAndTranslateQuery(message, backgroundAI);
      logCpuUsage(requestId, 'Query Expansion/Translation', expandStartCpu);
      console.log(`[${requestId}] 🔍 Expanded query: "${expandedQuery.substring(0, 200)}${expandedQuery.length > 200 ? '...' : ''}"`);
    } catch (error) {
      logCpuUsage(requestId, 'Query Expansion/Translation (failed)', expandStartCpu);
      console.error(`[${requestId}] ⚠️ Query expansion failed, using original query:`, error);
      expandedQuery = message;
    }

    // Step 3: Load chunks
    const chunkLoadStartCpu = process.cpuUsage();
    const chunkLoadStartTime = Date.now();
    let chunks;
    
    if (process.env.DATABASE_URL && querySubjects.length > 0 && enableSubjectFilter) {
      console.log(`[${requestId}] 🔍 Attempting to load chunks with subject filter: [${querySubjects.join(', ')}]`);
      try {
        const filteredChunks = await loadAllChunks(querySubjects);
        console.log(`[${requestId}] 📊 Subject filter result: ${filteredChunks.length} chunks found`);
        if (filteredChunks.length === 0) {
          console.log(`[${requestId}] ⚠️ No chunks found with subject filter [${querySubjects.join(', ')}], loading all chunks as fallback...`);
          chunks = await loadAllChunks();
          console.log(`[${requestId}] 📊 Fallback result: ${chunks.length} total chunks loaded (no subject filter)`);
        } else {
          chunks = filteredChunks;
          console.log(`[${requestId}] ✅ Loaded ${chunks.length} chunks from subjects: [${querySubjects.join(', ')}]`);
        }
      } catch (error) {
        console.error(`[${requestId}] ⚠️ Subject filter failed, loading all chunks:`, error);
        chunks = await loadAllChunks();
        console.log(`[${requestId}] 📊 Error fallback result: ${chunks.length} total chunks loaded`);
      }
    } else {
      console.log(`[${requestId}] 🔍 Loading all chunks (no subject filter or no DATABASE_URL)`);
      chunks = await loadAllChunks();
      console.log(`[${requestId}] 📊 Loaded ${chunks.length} chunks (no subject filter)`);
    }
    
    const chunkLoadTime = Date.now() - chunkLoadStartTime;
    logCpuUsage(requestId, `Chunk Loading (${chunks.length} chunks, ${chunkLoadTime}ms)`, chunkLoadStartCpu);

    if (chunks.length === 0) {
      console.error(`[${requestId}] ❌ CRITICAL: No chunks loaded! Database might be empty or connection failed.`);
      return '❌ Error: No documents available. Please check database connection and ensure documents are migrated.';
    }

    // Step 4: Generate response
    const ragStartCpu = process.cpuUsage();
    const ragStartTime = Date.now();
    const response = await generateChatResponse(message, chunks, requestId, provider, expandedQuery);
    const ragTime = Date.now() - ragStartTime;
    logCpuUsage(requestId, `RAG + AI Response (${ragTime}ms)`, ragStartCpu);
    
    // Final summary
    const totalTime = Date.now() - requestStartTime;
    logCpuUsage(requestId, `Total Request (${totalTime}ms)`, requestStartCpu);
    console.log(`[${requestId}] ✅ Request completed in ${totalTime}ms`);
    console.log(`${'='.repeat(80)}\n`);

    return response;
  } catch (error) {
    console.error(`[${requestId}] ❌ Error processing query:`, error);
    return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Interactive mode - keep asking for queries
 */
async function interactiveMode(
  provider: 'openai' | 'gemini' | 'glm',
  backgroundAI: 'gemini' | 'glm',
  setProvider: (p: 'openai' | 'gemini' | 'glm') => void,
  setBackgroundAI: (b: 'gemini' | 'glm') => void
) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let currentProvider = provider;
  let currentBackgroundAI = backgroundAI;

  const showStatus = () => {
    console.log(`\n📊 Current Settings:`);
    console.log(`   Response AI: ${currentProvider.toUpperCase()}`);
    console.log(`   Background AI: ${currentBackgroundAI.toUpperCase()}`);
  };

  const askQuestion = () => {
    rl.question('\n💬 Enter your query (or "exit" to quit, "help" for commands): ', async (input) => {
      const query = input.trim().toLowerCase();
      
      if (query === 'exit' || query === 'quit' || query === 'q') {
        console.log('\n👋 Goodbye!');
        rl.close();
        process.exit(0);
      } else if (query === 'help' || query === 'h') {
        console.log('\n📖 Commands:');
        console.log('  exit, quit, q     - Exit the CLI');
        console.log('  help, h           - Show this help');
        console.log('  clear             - Clear the screen');
        console.log('  status            - Show current AI settings');
        console.log('\n🤖 Switch Response AI:');
        console.log('  provider openai   - Use OpenAI (gpt-4o-mini)');
        console.log('  provider gemini   - Use Google Gemini');
        console.log('  provider glm      - Use GLM-4.7');
        console.log('\n🔧 Switch Background AI:');
        console.log('  background gemini - Use Gemini for classification/expansion');
        console.log('  background glm    - Use GLM-4.7 for classification/expansion');
        console.log('\n💡 Tips:');
        console.log('  - Use quotes for multi-word queries');
        console.log('  - Try queries like: "summarize info-parents of January 2024"');
        console.log('  - Or: "give me the link to the info-parents of January 2024"');
        askQuestion();
      } else if (query === 'clear') {
        console.clear();
        showStatus();
        askQuestion();
      } else if (query === 'status') {
        showStatus();
        askQuestion();
      } else if (query.startsWith('provider ')) {
        const newProvider = query.substring(9).trim();
        if (newProvider === 'openai' || newProvider === 'gemini' || newProvider === 'glm') {
          currentProvider = newProvider as 'openai' | 'gemini' | 'glm';
          setProvider(currentProvider);
          console.log(`\n✅ Response AI switched to: ${currentProvider.toUpperCase()}`);
        } else {
          console.log(`\n❌ Invalid provider. Use: openai, gemini, or glm`);
        }
        askQuestion();
      } else if (query.startsWith('background ')) {
        const newBackground = query.substring(11).trim();
        if (newBackground === 'gemini' || newBackground === 'glm') {
          currentBackgroundAI = newBackground as 'gemini' | 'glm';
          setBackgroundAI(currentBackgroundAI);
          console.log(`\n✅ Background AI switched to: ${currentBackgroundAI.toUpperCase()}`);
        } else {
          console.log(`\n❌ Invalid background AI. Use: gemini or glm`);
        }
        askQuestion();
      } else if (query === '') {
        askQuestion();
      } else {
        const response = await processQuery(input.trim(), currentProvider, currentBackgroundAI);
        console.log(`\n🤖 Response:\n${response}\n`);
        askQuestion();
      }
    });
  };

  console.log('🚀 CLI Chat Tool - Interactive Mode');
  showStatus();
  console.log('💡 Type "help" for commands\n');
  askQuestion();
}

/**
 * Main function
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let provider: 'openai' | 'gemini' | 'glm' = 'glm';
  let backgroundAI: 'gemini' | 'glm' = 'glm';
  let query: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--provider' && i + 1 < args.length) {
      const p = args[i + 1].toLowerCase();
      if (p === 'openai' || p === 'gemini' || p === 'glm') {
        provider = p;
      }
      i++;
    } else if (args[i] === '--background-ai' && i + 1 < args.length) {
      const b = args[i + 1].toLowerCase();
      if (b === 'gemini' || b === 'glm') {
        backgroundAI = b;
      }
      i++;
    } else if (!args[i].startsWith('--')) {
      query = args.slice(i).join(' ');
      break;
    }
  }
  
  // Store current settings for interactive mode
  let currentProvider = provider;
  let currentBackgroundAI = backgroundAI;
  
  const setProvider = (p: 'openai' | 'gemini' | 'glm') => {
    currentProvider = p;
  };
  
  const setBackgroundAI = (b: 'gemini' | 'glm') => {
    currentBackgroundAI = b;
  };

  // Check database connection
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable not set');
    console.error('');
    console.error('   Please set DATABASE_URL in one of these ways:');
    console.error('   1. Create a .env.local file in the project root with:');
    console.error('      DATABASE_URL=postgresql://user:password@host:port/database');
    console.error('');
    console.error('   2. Or set it as an environment variable:');
    console.error('      $env:DATABASE_URL="postgresql://..."  (PowerShell)');
    console.error('      export DATABASE_URL="postgresql://..."  (Bash)');
    console.error('');
    console.error('   For Render database, use the External Connection String from your Render dashboard.');
    process.exit(1);
  }

  console.log('🔌 Connecting to database...');
  try {
    // Test connection by loading chunks
    const testChunks = await loadAllChunks();
    console.log(`✅ Connected! Found ${testChunks.length} chunks in database\n`);
  } catch (error) {
    console.error('❌ Error connecting to database:', error);
    console.error('   Please check your DATABASE_URL and ensure the database is accessible');
    process.exit(1);
  }

  // Run query or interactive mode
  if (query) {
    // Single query mode
    const response = await processQuery(query, provider, backgroundAI);
    console.log(`\n🤖 Response:\n${response}\n`);
    process.exit(0);
  } else {
    // Interactive mode
    await interactiveMode(currentProvider, currentBackgroundAI, setProvider, setBackgroundAI);
  }
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

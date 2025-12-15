#!/usr/bin/env tsx
/**
 * Test Translation
 * 
 * Simple script to test if translation from English to French is working
 */

import 'dotenv/config';
import OpenAI from 'openai';

// Initialize OpenAI client
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return new OpenAI({ apiKey });
}

/**
 * Translate query to French using Google Translate or OpenAI
 */
async function translateQueryToFrench(query: string, client: OpenAI): Promise<string> {
  try {
    // Simple heuristic: if query contains common English words, translate it
    const englishWords = ['the', 'is', 'are', 'who', 'what', 'where', 'when', 'why', 'how', 'can', 'will', 'principal', 'school'];
    const hasEnglishWords = englishWords.some(word => query.toLowerCase().includes(word));
    
    if (!hasEnglishWords) {
      // Probably already in French or another language
      console.log(`   ℹ️  No English words detected, skipping translation`);
      return query;
    }
    
    // Try free Google Translate first (no API key needed)
    try {
      console.log(`   🔄 Trying Google Translate...`);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const translate = require('@vitalets/google-translate-api');
      // The package exports translate as default or named export - try both
      const translateFn = translate.default || translate.translate || translate;
      const result = await translateFn(query, { to: 'fr' });
      console.log(`   ✅ Google Translate success!`);
      return result.text;
    } catch (googleError) {
      // Fallback to OpenAI if Google Translate fails
      console.warn(`   ⚠️  Google Translate failed: ${googleError instanceof Error ? googleError.message : 'Unknown error'}`);
      
      if (!client) {
        throw new Error('OpenAI client not available');
      }
      
      console.log(`   🔄 Trying OpenAI translation...`);
      
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini', // Use a cheaper model for translation
        messages: [
          {
            role: 'system',
            content: 'You are a translator. Translate the user\'s question to French. Only return the translation, nothing else.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        temperature: 0.3,
        max_tokens: 100,
      });
      
      const translation = response.choices[0]?.message?.content?.trim() || query;
      console.log(`   ✅ OpenAI translation success!`);
      return translation;
    }
  } catch (error) {
    console.warn(`   ❌ Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return query;
  }
}

async function main() {
  console.log('🧪 Testing Translation System\n');
  console.log('='.repeat(60));
  
  // Try to get OpenAI client, but continue even if it fails (for Google Translate test)
  let client: OpenAI | null = null;
  try {
    client = getOpenAIClient();
  } catch (error) {
    console.log('⚠️  OpenAI not available (will use Google Translate only)\n');
  }
  
  const testQueries = [
    'who is the principal of the school?',
    'what are the school hours?',
    'where is the cafeteria?',
    'when is the next parent meeting?',
    'Bonjour, qui est la directrice?', // Already in French
  ];
  
  for (const query of testQueries) {
    console.log(`\n📝 Original: "${query}"`);
    try {
      const translated = await translateQueryToFrench(query, client!);
      console.log(`   🌐 Translated: "${translated}"`);
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    console.log('-'.repeat(60));
  }
  
  console.log('\n✅ Translation test complete!\n');
}

main().catch(console.error);


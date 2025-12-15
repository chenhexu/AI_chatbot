#!/usr/bin/env tsx
/**
 * Test Principal Query
 * 
 * Test if "who is the principal" query finds relevant chunks
 */

import 'dotenv/config';
import { loadAllDocuments } from '../lib/documentLoader';
import { processDocuments, findRelevantChunks, calculateSimilarity, type TextChunk } from '../lib/rag';
import { translateQueryToFrench } from '../lib/openai';
import OpenAI from 'openai';

async function main() {
  console.log('🧪 Testing Principal Query\n');
  console.log('='.repeat(80));
  
  // Load documents
  console.log('\n📚 Loading documents...');
  const documents = await loadAllDocuments();
  const chunks = processDocuments(documents);
  console.log(`✅ Loaded ${documents.length} documents, created ${chunks.length} chunks\n`);
  
  // Test query
  const englishQuery = 'who is the principal of the school?';
  console.log(`\n🔍 Testing query: "${englishQuery}"`);
  console.log('='.repeat(80));
  
  // Translate query
  let translatedQuery = englishQuery;
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const client = new OpenAI({ apiKey });
      translatedQuery = await translateQueryToFrench(englishQuery, client);
      console.log(`\n🌐 Translation: "${englishQuery}" -> "${translatedQuery}"\n`);
    } else {
      console.log(`\n⚠️  No OpenAI API key, skipping translation (will test with original query only)\n`);
    }
  } catch (error) {
    console.warn(`\n⚠️  Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
  }
  
  // Test with original query
  console.log('\n📊 Testing with ORIGINAL English query:');
  console.log('-'.repeat(80));
  const chunksOriginal = findRelevantChunks(chunks, englishQuery, 5);
  console.log(`Found ${chunksOriginal.length} chunks with original query`);
  chunksOriginal.forEach((chunk, i) => {
    const score = calculateSimilarity(englishQuery, chunk.text);
    const preview = chunk.text.substring(0, 200).replace(/\n/g, ' ');
    console.log(`\n${i + 1}. Score: ${(score * 100).toFixed(2)}% | Source: ${chunk.source.split('/').pop()}`);
    console.log(`   Preview: ${preview}...`);
  });
  
  // Test with translated query
  console.log('\n\n📊 Testing with TRANSLATED French query:');
  console.log('-'.repeat(80));
  const chunksTranslated = findRelevantChunks(chunks, translatedQuery, 5);
  console.log(`Found ${chunksTranslated.length} chunks with translated query`);
  chunksTranslated.forEach((chunk, i) => {
    const score = calculateSimilarity(translatedQuery, chunk.text);
    const preview = chunk.text.substring(0, 200).replace(/\n/g, ' ');
    console.log(`\n${i + 1}. Score: ${(score * 100).toFixed(2)}% | Source: ${chunk.source.split('/').pop()}`);
    console.log(`   Preview: ${preview}...`);
  });
  
  // Check if any chunks contain director patterns
  console.log('\n\n🔍 Searching for director patterns in all chunks:');
  console.log('-'.repeat(80));
  const directorPattern = /(?:[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+(?:\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+)*\s*[,:\n\-]\s*(?:directrice|directeur|directice)|(?:directrice|directeur|directice)\s*[,:\n\-]\s*[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+(?:\s+[A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ][a-zàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ]+)*)/gi;
  
  let foundDirectors = 0;
  chunks.forEach((chunk, i) => {
    const matches = chunk.text.match(directorPattern);
    if (matches && matches.length > 0) {
      foundDirectors++;
      if (foundDirectors <= 5) {
        console.log(`\nFound director pattern in chunk ${i} (${chunk.source.split('/').pop()}):`);
        console.log(`  Matches: ${matches.slice(0, 3).join(', ')}`);
        const preview = chunk.text.substring(0, 300).replace(/\n/g, ' ');
        console.log(`  Preview: ${preview}...`);
      }
    }
  });
  
  console.log(`\n\n✅ Found ${foundDirectors} chunks containing director patterns out of ${chunks.length} total chunks`);
  console.log('\n' + '='.repeat(80));
}

main().catch(console.error);


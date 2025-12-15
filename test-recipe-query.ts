/**
 * Test script to verify AI can understand OCR-processed recipe PDFs
 */

import * as dotenv from 'dotenv';
import { loadAllDocuments } from './lib/documentLoader';
import { processDocuments, findRelevantChunks, type TextChunk } from './lib/rag';
import { generateChatResponse } from './lib/openai';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testRecipeQuery() {
  console.log('🧪 Testing Recipe Query with OCR-Processed PDFs\n');
  console.log('='.repeat(80));
  
  // Load documents (includes OCR-processed PDFs)
  console.log('\n📚 Loading documents...');
  const documents = await loadAllDocuments();
  const chunks = processDocuments(documents);
  console.log(`✅ Loaded ${documents.length} documents, created ${chunks.length} chunks\n`);
  
  // Test query about the lentil curry recipe
  const query = "Quels sont les ingrédients pour le cari de lentilles et de pommes de terre?";
  
  console.log(`\n🔍 Query: "${query}"`);
  console.log('='.repeat(80));
  
  // Find relevant chunks
  const relevantChunks = findRelevantChunks(chunks, query, 5);
  console.log(`\n📄 Found ${relevantChunks.length} relevant chunks:`);
  
  relevantChunks.forEach((chunk, i) => {
    const preview = chunk.text.substring(0, 200).replace(/\n/g, ' ');
    console.log(`\n${i + 1}. Source: ${chunk.source.split('/').pop()}`);
    console.log(`   Preview: ${preview}...`);
  });
  
  // Generate AI response
  console.log(`\n\n🤖 Generating AI response...`);
  console.log('='.repeat(80));
  
  try {
    const response = await generateChatResponse(query, chunks);
    console.log(`\n✅ AI Response:\n`);
    console.log(response);
    console.log('\n' + '='.repeat(80));
  } catch (error) {
    console.error('\n❌ Error generating response:', error);
    process.exit(1);
  }
}

// Run the test
testRecipeQuery().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});










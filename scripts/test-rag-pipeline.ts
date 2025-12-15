#!/usr/bin/env tsx
/**
 * Test RAG Pipeline
 * 
 * Verifies that external, pages, and pdf-texts folders are properly
 * loaded into RAG and can be queried.
 */

import { loadAllDocuments } from '../lib/documentLoader';
import { processDocuments, findRelevantChunks } from '../lib/rag';
import * as path from 'path';

async function main() {
  console.log('🧪 Testing RAG Pipeline...\n');
  
  try {
    // Step 1: Load all documents
    console.log('📚 Step 1: Loading documents...');
    const documents = await loadAllDocuments();
    console.log(`   ✅ Loaded ${documents.length} documents\n`);
    
    // Step 2: Process into chunks
    console.log('✂️  Step 2: Processing documents into chunks...');
    const chunks = processDocuments(documents);
    console.log(`   ✅ Created ${chunks.length} chunks\n`);
    
    // Step 3: Analyze sources
    console.log('📊 Step 3: Analyzing document sources...');
    const sourceCategories: { [key: string]: number } = {};
    
    for (const chunk of chunks) {
      const source = chunk.source;
      let category = 'unknown';
      
      if (source.includes('pages/')) {
        category = 'pages';
      } else if (source.includes('external/')) {
        category = 'external';
      } else if (source.includes('pdf-texts/')) {
        category = 'pdf-texts';
      } else if (source.includes('pdfs/')) {
        category = 'pdfs';
      } else if (source.includes('google-doc')) {
        category = 'google-docs';
      }
      
      sourceCategories[category] = (sourceCategories[category] || 0) + 1;
    }
    
    console.log('   📁 Chunks by source category:');
    for (const [category, count] of Object.entries(sourceCategories)) {
      console.log(`      - ${category}: ${count} chunks`);
    }
    console.log();
    
    // Step 4: Test queries
    console.log('🔍 Step 4: Testing query retrieval...');
    const testQueries = [
      'personnel',
      'recette',
      'ingrédients',
      'horaire',
      'activité',
    ];
    
    for (const query of testQueries) {
      const relevantChunks = findRelevantChunks(chunks, query, 3);
      console.log(`   Query: "${query}"`);
      console.log(`      Found ${relevantChunks.length} relevant chunks`);
      
      if (relevantChunks.length > 0) {
        const topChunk = relevantChunks[0];
        const sourceName = path.basename(topChunk.source);
        const preview = topChunk.text.substring(0, 100).replace(/\n/g, ' ');
        console.log(`      Top source: ${sourceName}`);
        console.log(`      Preview: ${preview}...`);
      }
      console.log();
    }
    
    // Step 5: Verify all three folders are included
    console.log('✅ Step 5: Verifying folder inclusion...');
    const hasPages = sourceCategories['pages'] > 0;
    const hasExternal = sourceCategories['external'] > 0;
    const hasPdfTexts = sourceCategories['pdf-texts'] > 0;
    
    console.log(`   ${hasPages ? '✅' : '❌'} Pages folder: ${hasPages ? `${sourceCategories['pages']} chunks` : 'NOT FOUND'}`);
    console.log(`   ${hasExternal ? '✅' : '❌'} External folder: ${hasExternal ? `${sourceCategories['external']} chunks` : 'NOT FOUND'}`);
    console.log(`   ${hasPdfTexts ? '✅' : '❌'} PDF-texts folder: ${hasPdfTexts ? `${sourceCategories['pdf-texts']} chunks` : 'NOT FOUND'}`);
    console.log();
    
    if (hasPages && hasExternal && hasPdfTexts) {
      console.log('🎉 SUCCESS! All three folders are properly integrated into RAG!');
    } else {
      console.log('⚠️  WARNING: Some folders are missing from RAG!');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error testing RAG pipeline:', error);
    process.exit(1);
  }
}

main();






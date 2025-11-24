import * as readline from 'readline';
import * as dotenv from 'dotenv';
import { loadAllDocuments } from './lib/documentLoader';
import { processDocuments, findRelevantChunks, calculateSimilarity, type TextChunk } from './lib/rag';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Cache for document chunks
let cachedChunks: TextChunk[] | null = null;

async function loadDocuments() {
  console.log('Loading documents...\n');
  try {
    const documents = await loadAllDocuments();
    cachedChunks = processDocuments(documents);
    console.log(`✓ Loaded ${documents.length} document(s)`);
    console.log(`✓ Created ${cachedChunks.length} text chunks\n`);
    return cachedChunks;
  } catch (error) {
    console.error('Error loading documents:', error);
    process.exit(1);
  }
}


function testQuery(query: string, chunks: TextChunk[]) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Query: "${query}"`);
  console.log(`${'='.repeat(80)}\n`);
  
  // Calculate similarity scores for all chunks
  const scoredChunks = chunks.map((chunk, index) => {
    const score = calculateSimilarity(query, chunk.text);
    return {
      chunk,
      score,
      index,
    };
  });
  
  // Sort by score (descending)
  scoredChunks.sort((a, b) => b.score - a.score);
  
  // Show top 10 matches
  console.log(`Top 10 matching chunks (out of ${chunks.length} total):\n`);
  
  const topChunks = scoredChunks.slice(0, 10);
  
  topChunks.forEach((item, i) => {
    const percentage = (item.score * 100).toFixed(2);
    const preview = item.chunk.text.substring(0, 150).replace(/\n/g, ' ');
    const ellipsis = item.chunk.text.length > 150 ? '...' : '';
    
    console.log(`${i + 1}. Score: ${percentage}% | Chunk #${item.index}`);
    console.log(`   Source: ${item.chunk.source}`);
    console.log(`   Preview: ${preview}${ellipsis}`);
    console.log('');
  });
  
  // Show statistics
  const avgScore = scoredChunks.reduce((sum, item) => sum + item.score, 0) / scoredChunks.length;
  const maxScore = scoredChunks[0]?.score || 0;
  const chunksWithScore = scoredChunks.filter(item => item.score > 0).length;
  
  console.log(`Statistics:`);
  console.log(`  - Average score: ${(avgScore * 100).toFixed(2)}%`);
  console.log(`  - Highest score: ${(maxScore * 100).toFixed(2)}%`);
  console.log(`  - Chunks with score > 0: ${chunksWithScore}/${chunks.length}`);
  console.log(`  - Chunks that would be used (top 5): ${Math.min(5, chunksWithScore)}`);
  
  // Show what would be selected
  const selectedChunks = findRelevantChunks(chunks, query, 5);
  console.log(`\n✓ Selected ${selectedChunks.length} chunk(s) for RAG context\n`);
}

async function main() {
  console.log('RAG Search Test Tool\n');
  
  // Load documents
  const chunks = await loadDocuments();
  
  console.log('Type your questions below. Type "exit" or "quit" to stop.\n');
  
  function askQuestion() {
    rl.question('Question: ', (query) => {
      if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
        console.log('\nGoodbye!');
        rl.close();
        process.exit(0);
      }
      
      if (query.trim()) {
        testQuery(query, chunks);
      }
      
      askQuestion();
    });
  }
  
  askQuestion();
}

// Run the test
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


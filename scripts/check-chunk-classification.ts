import { query } from '../lib/database/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local or .env
const envPathLocal = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (require('fs').existsSync(envPathLocal)) {
  dotenv.config({ path: envPathLocal });
  console.log('📄 Loaded environment from .env.local');
} else if (require('fs').existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('📄 Loaded environment from .env');
} else {
  console.warn('⚠️ No .env.local or .env file found. Environment variables must be set manually.');
}

/**
 * Check chunk classification coverage
 * Shows how many chunks are classified vs unclassified
 */
async function checkClassification() {
  console.log('🔍 Checking chunk classification coverage...\n');

  try {
    // Overall stats
    const totalChunks = await query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');
    const classifiedChunks = await query<{ count: string }>(
      "SELECT COUNT(*) as count FROM chunks WHERE subject IS NOT NULL AND subject != 'low_confidence'"
    );
    const unclassifiedChunks = await query<{ count: string }>(
      "SELECT COUNT(*) as count FROM chunks WHERE subject IS NULL"
    );
    const lowConfidenceChunks = await query<{ count: string }>(
      "SELECT COUNT(*) as count FROM chunks WHERE subject = 'low_confidence'"
    );

    const total = parseInt(totalChunks.rows[0].count);
    const classified = parseInt(classifiedChunks.rows[0].count);
    const unclassified = parseInt(unclassifiedChunks.rows[0].count);
    const lowConfidence = parseInt(lowConfidenceChunks.rows[0].count);

    console.log('📊 OVERALL CLASSIFICATION STATS');
    console.log(`   Total chunks: ${total}`);
    console.log(`   Classified: ${classified} (${((classified / total) * 100).toFixed(1)}%)`);
    console.log(`   Unclassified (NULL): ${unclassified} (${((unclassified / total) * 100).toFixed(1)}%)`);
    console.log(`   Low confidence: ${lowConfidence} (${((lowConfidence / total) * 100).toFixed(1)}%)\n`);

    // Breakdown by subject
    console.log('📋 BREAKDOWN BY SUBJECT');
    const subjectBreakdown = await query<{
      subject: string | null;
      count: string;
    }>(
      `SELECT subject, COUNT(*) as count 
       FROM chunks 
       GROUP BY subject 
       ORDER BY count DESC`
    );

    subjectBreakdown.rows.forEach(row => {
      const subject = row.subject || 'NULL (unclassified)';
      const count = parseInt(row.count);
      const percentage = ((count / total) * 100).toFixed(1);
      const status = row.subject === null ? '⚠️' : row.subject === 'low_confidence' ? '❌' : '✅';
      console.log(`   ${status} ${subject}: ${count} chunks (${percentage}%)`);
    });

    console.log('\n');

    // Check if failing categories have chunks
    console.log('🔍 CHECKING FAILING CATEGORIES');
    const failingCategories = ['academics', 'sports', 'general', 'students', 'events', 'recipes'];
    
    for (const category of failingCategories) {
      const categoryChunks = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM chunks WHERE subject = $1`,
        [category]
      );
      const count = parseInt(categoryChunks.rows[0].count);
      const status = count > 0 ? '✅' : '❌';
      console.log(`   ${status} ${category}: ${count} chunks`);
    }

    console.log('\n');

    // Recommendations
    if (unclassified > total * 0.1) {
      console.log('⚠️  WARNING: More than 10% of chunks are unclassified');
      console.log('   → Run classification process to improve filtering\n');
    }

    if (lowConfidence > total * 0.1) {
      console.log('⚠️  WARNING: More than 10% of chunks are marked as low_confidence');
      console.log('   → These chunks are excluded from search results\n');
    }

    const categoriesWithNoChunks = failingCategories.filter(async cat => {
      const result = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM chunks WHERE subject = $1`,
        [cat]
      );
      return parseInt(result.rows[0].count) === 0;
    });

    if (categoriesWithNoChunks.length > 0) {
      console.log('💡 RECOMMENDATIONS:');
      console.log(`   Categories with no chunks: ${categoriesWithNoChunks.join(', ')}`);
      console.log('   → Either add documents for these categories or improve classification\n');
    }

    console.log('✅ Check complete!');
  } catch (error) {
    console.error('❌ Error checking classification:', error);
    process.exit(1);
  }
}

checkClassification()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

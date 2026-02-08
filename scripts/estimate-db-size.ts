/**
 * Script to estimate database size and check if 1GB is enough
 * 
 * Usage:
 * 1. Set DATABASE_URL environment variable
 * 2. Run: npx tsx scripts/estimate-db-size.ts
 */

import { Pool } from 'pg';

async function estimateSize() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const pool = new Pool({ 
    connectionString: dbUrl,
    ssl: dbUrl.includes('azure') || dbUrl.includes('postgres.database.azure.com') 
      ? { rejectUnauthorized: false } 
      : false,
  });

  try {
    console.log('📊 Analyzing database size...\n');

    // Get table counts
    const docCount = await pool.query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
    const chunkCount = await pool.query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');
    const failedCount = await pool.query<{ count: string }>('SELECT COUNT(*) as count FROM failed_classifications');

    // Get actual database size
    const dbSize = await pool.query<{ size: string; size_bytes: string }>(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as size,
        pg_database_size(current_database()) as size_bytes
    `);

    // Get table sizes
    const tableSizes = await pool.query<{ 
      table_name: string; 
      size: string; 
      size_bytes: string;
    }>(`
      SELECT 
        schemaname || '.' || tablename AS table_name,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);

    // Estimate content sizes
    const docContentEstimate = await pool.query<{ 
      doc_content_size: string;
    }>(`
      SELECT 
        pg_size_pretty(SUM(pg_column_size(content))) as doc_content_size
      FROM documents
    `);

    const chunkContentEstimate = await pool.query<{ 
      chunk_text_size: string;
      avg_chunk_size: string;
    }>(`
      SELECT 
        pg_size_pretty(SUM(pg_column_size(text))) as chunk_text_size,
        ROUND(AVG(pg_column_size(text))) as avg_chunk_size
      FROM chunks
    `);

    // Count classified chunks
    const classifiedCount = await pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM chunks WHERE subject IS NOT NULL'
    );

    const sizeBytes = parseInt(dbSize.rows[0].size_bytes, 10);
    const oneGB = 1024 * 1024 * 1024;
    const usagePercent = (sizeBytes / oneGB) * 100;

    console.log('📈 Database Statistics:');
    console.log('─'.repeat(50));
    console.log(`Total database size: ${dbSize.rows[0].size}`);
    console.log(`   (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`   ${usagePercent.toFixed(2)}% of 1GB\n`);

    console.log('📊 Table Counts:');
    console.log('─'.repeat(50));
    console.log(`Documents: ${docCount.rows[0].count}`);
    console.log(`Chunks: ${chunkCount.rows[0].count}`);
    console.log(`  └─ Classified: ${classifiedCount.rows[0].count}`);
    console.log(`Failed classifications: ${failedCount.rows[0].count}\n`);

    console.log('💾 Table Sizes:');
    console.log('─'.repeat(50));
    for (const row of tableSizes.rows) {
      const mb = (parseInt(row.size_bytes, 10) / 1024 / 1024).toFixed(2);
      console.log(`${row.table_name}: ${row.size} (${mb} MB)`);
    }

    console.log('\n📝 Content Estimates:');
    console.log('─'.repeat(50));
    if (docContentEstimate.rows[0]) {
      console.log(`Document content: ${docContentEstimate.rows[0].doc_content_size || 'N/A'}`);
    }
    if (chunkContentEstimate.rows[0]) {
      console.log(`Chunk text: ${chunkContentEstimate.rows[0].chunk_text_size || 'N/A'}`);
      console.log(`Average chunk size: ${chunkContentEstimate.rows[0].avg_chunk_size || '0'} bytes`);
    }

    console.log('\n✅ Storage Assessment:');
    console.log('─'.repeat(50));
    if (sizeBytes < oneGB * 0.5) {
      console.log('✅ 1GB storage is MORE THAN ENOUGH');
      console.log(`   Current usage: ${usagePercent.toFixed(1)}% of 1GB`);
      console.log(`   You have ~${((oneGB - sizeBytes) / 1024 / 1024).toFixed(0)} MB remaining`);
    } else if (sizeBytes < oneGB * 0.8) {
      console.log('⚠️  1GB storage is SUFFICIENT but getting close');
      console.log(`   Current usage: ${usagePercent.toFixed(1)}% of 1GB`);
      console.log(`   You have ~${((oneGB - sizeBytes) / 1024 / 1024).toFixed(0)} MB remaining`);
      console.log('   Consider monitoring growth');
    } else {
      console.log('❌ 1GB storage may NOT be enough');
      console.log(`   Current usage: ${usagePercent.toFixed(1)}% of 1GB`);
      console.log(`   You need at least ${((sizeBytes / oneGB) * 1024).toFixed(0)} MB`);
      console.log('   Consider upgrading to a larger plan');
    }

    // Growth estimate (rough)
    const avgChunkSize = parseInt(chunkContentEstimate.rows[0]?.avg_chunk_size || '0', 10);
    if (avgChunkSize > 0) {
      const chunksPerMB = (1024 * 1024) / avgChunkSize;
      const remainingMB = (oneGB - sizeBytes) / 1024 / 1024;
      const estimatedChunks = Math.floor(remainingMB * chunksPerMB);
      
      console.log('\n📈 Growth Estimates:');
      console.log('─'.repeat(50));
      console.log(`With current average chunk size (${avgChunkSize} bytes):`);
      console.log(`   You can add ~${estimatedChunks.toLocaleString()} more chunks`);
      console.log(`   (assuming similar average size)`);
    }

    console.log('\n💡 Recommendations:');
    console.log('─'.repeat(50));
    if (sizeBytes < oneGB * 0.5) {
      console.log('✅ 1GB is sufficient for your current needs');
      console.log('✅ Render free tier (1GB) should work fine');
      console.log('✅ Consider Supabase free tier (500MB) or Neon free tier (3GB)');
    } else if (sizeBytes < oneGB) {
      console.log('⚠️  1GB is sufficient but monitor growth');
      console.log('✅ Render starter ($7/month, 1GB) should work');
      console.log('✅ Consider Supabase Pro ($25/month, 8GB) for more headroom');
      console.log('✅ Or Neon free tier (3GB) for more space');
    } else {
      console.log('❌ You need more than 1GB');
      console.log('✅ Consider Supabase Pro ($25/month, 8GB)');
      console.log('✅ Or Neon Pro ($19/month, 10GB)');
      console.log('✅ Or Render Standard ($20/month, 10GB)');
    }

  } catch (error) {
    console.error('❌ Failed to estimate size:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

estimateSize().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

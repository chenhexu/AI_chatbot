import { query } from '../lib/database/client';

/**
 * Script to check info-parents documents and chunks in the database
 * Helps debug why info-parents queries aren't working
 */
async function checkInfoParents() {
  console.log('🔍 Checking info-parents documents and chunks in database...\n');

  try {
    // 1. Find all chunks containing "info-parents" in text or source
    console.log('📊 Step 1: Finding chunks with "info-parents" in text or source...');
    const infoParentsChunks = await query<{
      id: number;
      text: string;
      source: string;
      subject: string | null;
      pdf_url: string | null;
      chunk_index: number;
    }>(`
      SELECT id, text, source, subject, pdf_url, chunk_index
      FROM chunks
      WHERE LOWER(text) LIKE '%info-parents%' 
         OR LOWER(text) LIKE '%info parents%'
         OR LOWER(text) LIKE '%infos-parents%'
         OR LOWER(source) LIKE '%info-parents%'
         OR LOWER(source) LIKE '%info parents%'
         OR LOWER(source) LIKE '%infos-parents%'
      ORDER BY source, chunk_index
      LIMIT 50
    `);

    console.log(`   Found ${infoParentsChunks.rows.length} chunks containing "info-parents" pattern\n`);

    if (infoParentsChunks.rows.length === 0) {
      console.log('❌ ERROR: No chunks found with "info-parents" pattern!');
      console.log('   This means either:');
      console.log('   1. Documents were not crawled/processed');
      console.log('   2. Documents are stored with different naming');
      console.log('   3. Database migration did not include these documents\n');
    } else {
      // 2. Show subject classifications
      console.log('📊 Step 2: Analyzing subject classifications...');
      const subjectCounts = new Map<string, number>();
      infoParentsChunks.rows.forEach(row => {
        const subject = row.subject || 'NULL';
        subjectCounts.set(subject, (subjectCounts.get(subject) || 0) + 1);
      });

      console.log('   Subject distribution:');
      Array.from(subjectCounts.entries()).forEach(([subject, count]) => {
        const status = subject === 'parents' ? '✅' : subject === 'NULL' ? '⚠️' : '❌';
        console.log(`   ${status} ${subject}: ${count} chunks`);
      });
      console.log();

      // 3. Check for low_confidence or NULL subjects
      const nullSubjects = infoParentsChunks.rows.filter(r => r.subject === null).length;
      const lowConfidence = infoParentsChunks.rows.filter(r => r.subject === 'low_confidence').length;
      
      if (nullSubjects > 0) {
        console.log(`⚠️ WARNING: ${nullSubjects} chunks have NULL subject (not classified)`);
      }
      if (lowConfidence > 0) {
        console.log(`⚠️ WARNING: ${lowConfidence} chunks have "low_confidence" subject (excluded from search)`);
      }
      console.log();

      // 4. Check PDF URLs
      console.log('📊 Step 3: Checking PDF URLs...');
      const withPdfUrl = infoParentsChunks.rows.filter(r => r.pdf_url !== null).length;
      console.log(`   Chunks with PDF URL: ${withPdfUrl}/${infoParentsChunks.rows.length}`);
      if (withPdfUrl === 0) {
        console.log('   ⚠️ WARNING: No PDF URLs found for info-parents chunks');
      }
      console.log();

      // 5. Show sample chunks
      console.log('📊 Step 4: Sample chunks (first 5):');
      infoParentsChunks.rows.slice(0, 5).forEach((row, i) => {
        console.log(`\n   Chunk ${i + 1}:`);
        console.log(`   - ID: ${row.id}`);
        console.log(`   - Source: ${row.source}`);
        console.log(`   - Subject: ${row.subject || 'NULL'}`);
        console.log(`   - PDF URL: ${row.pdf_url || 'NULL'}`);
        console.log(`   - Text preview: ${row.text.substring(0, 150).replace(/\n/g, ' ')}...`);
      });
      console.log();
    }

    // 6. Count chunks by subject for all documents
    console.log('📊 Step 5: Overall chunk distribution by subject...');
    const allSubjectCounts = await query<{
      subject: string | null;
      count: string;
    }>(`
      SELECT subject, COUNT(*) as count
      FROM chunks
      GROUP BY subject
      ORDER BY count DESC
    `);

    console.log('   Total chunks by subject:');
    allSubjectCounts.rows.forEach(row => {
      const subject = row.subject || 'NULL';
      const count = parseInt(row.count);
      console.log(`   - ${subject}: ${count} chunks`);
    });
    console.log();

    // 7. Check if there are any documents with "info-parents" in name
    console.log('📊 Step 6: Checking documents table...');
    const infoParentsDocs = await query<{
      id: number;
      source_id: string;
      name: string | null;
      pdf_url: string | null;
    }>(`
      SELECT id, source_id, name, pdf_url
      FROM documents
      WHERE LOWER(source_id) LIKE '%info-parents%'
         OR LOWER(source_id) LIKE '%info parents%'
         OR LOWER(source_id) LIKE '%infos-parents%'
         OR LOWER(name) LIKE '%info-parents%'
         OR LOWER(name) LIKE '%info parents%'
         OR LOWER(name) LIKE '%infos-parents%'
      ORDER BY id
    `);

    console.log(`   Found ${infoParentsDocs.rows.length} documents with "info-parents" in name/source`);
    if (infoParentsDocs.rows.length > 0) {
      console.log('   Sample documents:');
      infoParentsDocs.rows.slice(0, 5).forEach((doc, i) => {
        console.log(`   ${i + 1}. ${doc.name || doc.source_id} (ID: ${doc.id}, PDF: ${doc.pdf_url ? 'Yes' : 'No'})`);
      });
    }
    console.log();

    // 8. Summary and recommendations
    console.log('📋 Summary and Recommendations:');
    if (infoParentsChunks.rows.length === 0) {
      console.log('   ❌ CRITICAL: No info-parents chunks found in database');
      console.log('   → Action: Re-crawl or re-process documents');
    } else {
      // Get parents count from allSubjectCounts
      const parentsRow = allSubjectCounts.rows.find(row => (row.subject || 'NULL') === 'parents');
      const parentsSubjectCount = parentsRow ? parseInt(parentsRow.count) : 0;
      if (parentsSubjectCount === 0) {
        console.log('   ❌ CRITICAL: No chunks classified as "parents" subject');
        console.log('   → Action: Re-run classification for info-parents documents');
      } else if (parentsSubjectCount < infoParentsChunks.rows.length * 0.5) {
        console.log(`   ⚠️ WARNING: Only ${parentsSubjectCount}/${infoParentsChunks.rows.length} chunks classified as "parents"`);
        console.log('   → Action: Review classification logic or re-classify');
      } else {
        console.log(`   ✅ Good: ${parentsSubjectCount} chunks correctly classified as "parents"`);
      }

      const nullRow = allSubjectCounts.rows.find(row => (row.subject || 'NULL') === 'NULL');
      const nullCount = nullRow ? parseInt(nullRow.count) : 0;
      if (nullCount > 0) {
        console.log(`   ⚠️ WARNING: ${nullCount} chunks have NULL subject (need classification)`);
        console.log('   → Action: Run classification process');
      }
    }

    console.log('\n✅ Check complete!');
  } catch (error) {
    console.error('❌ Error checking database:', error);
    process.exit(1);
  }
}

// Run the check
checkInfoParents()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

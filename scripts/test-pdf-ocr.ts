/**
 * Test script for OCR PDF extraction
 * Tests OCR on difficult PDFs, especially recipe PDFs
 */

// Set UTF-8 encoding for console output (especially important on Windows)
if (process.platform === 'win32') {
  // Try to set console output to UTF-8
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { execSync } = require('child_process');
    execSync('chcp 65001 >nul 2>&1', { stdio: 'ignore' });
  } catch {
    // Ignore if chcp fails
  }
}

// Ensure stdout uses UTF-8
if (process.stdout.setDefaultEncoding) {
  process.stdout.setDefaultEncoding('utf8');
}
if (process.stderr.setDefaultEncoding) {
  process.stderr.setDefaultEncoding('utf8');
}

import * as path from 'path';
import * as fs from 'fs';
import { PDFProcessor } from '../lib/documentProcessors/pdfProcessor';

const testPdfs = [
  'colsaintlouis-docs_2023_RecettesVege_Cari_20de_20lentilles_20et_20de_20pommes_20de_20terre_20d_Evelyne_20Meloche_pdf_05378a51.pdf',
  'colsaintlouis-docs_2023_RecettesVege_Ragou_CC_82t_20africain_20mafe_CC_81_20de_20Nadine_20Allaire_pdf_cc9604c2.pdf',
  'colsaintlouis-docs_2023_RecettesVege_Pa_CC_82te_CC_81_20chinois_20ve_CC_81ge_CC_81tarien_20d_Amelie_20Fraser_20Pelletier_pdf_53a36b5b.pdf',
];

async function testPDFOCR() {
  console.log('🔍 Testing OCR PDF Extraction\n');
  console.log('=' .repeat(60));
  
  const processor = new PDFProcessor();
  const pdfsDir = path.resolve(process.cwd(), 'data/scraped/pdfs');
  
  if (!fs.existsSync(pdfsDir)) {
    console.error(`❌ PDFs directory not found: ${pdfsDir}`);
    process.exit(1);
  }

  for (const pdfName of testPdfs) {
    const pdfPath = path.join(pdfsDir, pdfName);
    
    if (!fs.existsSync(pdfPath)) {
      console.log(`\n⚠️  PDF not found: ${pdfName}`);
      console.log(`   Looking in: ${pdfPath}`);
      continue;
    }

    console.log(`\n📄 Testing: ${pdfName}`);
    console.log('-'.repeat(60));
    
    const startTime = Date.now();
    
    try {
      const source = {
        id: `file://pdfs/${pdfName}`,
        type: 'pdf' as const,
        name: `Test PDF: ${pdfName}`,
      };

      const result = await processor.process(source);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(`\n✅ OCR completed in ${elapsed}s`);
      console.log(`   Pages: ${result.metadata.pageCount}`);
      console.log(`   Words: ${result.metadata.wordCount}`);
      console.log(`   Content length: ${result.content.length} characters`);
      
      // Display first 500 characters of extracted text
      const preview = result.content.substring(0, 500);
      console.log(`\n📝 Extracted text preview:`);
      console.log('-'.repeat(60));
      // Write with explicit UTF-8 encoding
      process.stdout.write(Buffer.from(preview, 'utf8'));
      console.log(''); // New line
      if (result.content.length > 500) {
        console.log(`\n... (${result.content.length - 500} more characters)`);
      }
      
      // Check for key recipe terms
      const contentLower = result.content.toLowerCase();
      const hasIngredients = contentLower.includes('ingrédients') || contentLower.includes('ingredients');
      const hasPreparation = contentLower.includes('préparation') || contentLower.includes('preparation');
      const hasLentilles = contentLower.includes('lentilles') || contentLower.includes('lentil');
      const hasCari = contentLower.includes('cari') || contentLower.includes('curry');
      const hasRicardo = contentLower.includes('ricardo');
      
      console.log(`\n🔍 Key terms found:`);
      console.log(`   - Ingredients: ${hasIngredients ? '✅' : '❌'}`);
      console.log(`   - Preparation: ${hasPreparation ? '✅' : '❌'}`);
      console.log(`   - Lentilles: ${hasLentilles ? '✅' : '❌'}`);
      console.log(`   - Cari/Curry: ${hasCari ? '✅' : '❌'}`);
      console.log(`   - Ricardo: ${hasRicardo ? '✅' : '❌'}`);
      
      if (result.content.trim().length === 0) {
        console.log(`\n⚠️  WARNING: No text extracted from PDF!`);
      }
      
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`\n❌ Error after ${elapsed}s:`);
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ OCR testing complete!');
}

// Run the test
testPDFOCR().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


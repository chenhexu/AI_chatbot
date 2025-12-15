#!/usr/bin/env tsx
/**
 * Standalone PDF-OCR Processor
 * 
 * Converts PDF files to .txt files using OCR (Tesseract.js)
 * 
 * Usage:
 *   tsx scripts/process-pdf-ocr.ts <file1.pdf> [file2.pdf ...]
 *   tsx scripts/process-pdf-ocr.ts <folder>
 *   tsx scripts/process-pdf-ocr.ts <file1.pdf> <file2.pdf> <folder>
 * 
 * Output: .txt files saved to data/scraped/pdf-texts/
 */

import * as fs from 'fs';
import * as path from 'path';
import { createCanvas } from 'canvas';
import { correctOCRText } from '../lib/ocrCorrector';
import * as crypto from 'crypto';

/**
 * Get output directory for PDF text files
 */
function getOutputDir(): string {
  const baseDir = process.env.CRAWLER_DATA_FOLDER || './data/scraped';
  const outputDir = path.resolve(process.cwd(), baseDir, 'pdf-texts');
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  return outputDir;
}

/**
 * Generate unique filename for output .txt file
 */
function getOutputFilePath(pdfPath: string): string {
  const stats = fs.statSync(pdfPath);
  const fileInfo = `${pdfPath}:${stats.mtime.getTime()}:${stats.size}`;
  const cacheKey = crypto.createHash('md5').update(fileInfo).digest('hex');
  
  const outputDir = getOutputDir();
  const pdfName = path.basename(pdfPath, '.pdf');
  const safeName = pdfName.replace(/[^a-zA-Z0-9_-]/g, '_');
  
  return path.join(outputDir, `${safeName}_${cacheKey}.txt`);
}

/**
 * Process a single PDF file and save as .txt
 */
async function processPDF(pdfPath: string): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  const pdfName = path.basename(pdfPath);
  console.log(`\n📄 Processing: ${pdfName}`);
  
  if (!fs.existsSync(pdfPath)) {
    return { success: false, error: `File not found: ${pdfPath}` };
  }
  
  // Check if already processed
  const outputPath = getOutputFilePath(pdfPath);
  if (fs.existsSync(outputPath)) {
    const existingContent = fs.readFileSync(outputPath, 'utf8');
    if (existingContent.trim().length > 0) {
      console.log(`   ✓ Already processed (skipping): ${path.basename(outputPath)}`);
      return { success: true, outputPath };
    }
  }
  
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const uint8Array = new Uint8Array(dataBuffer);
    
    // First, try pdf-parse to see if PDF has extractable text (faster)
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      const msg = args[0]?.toString() || '';
      if (!msg.includes('Warning: TT:') && !msg.includes('undefined function')) {
        originalWarn(...args);
      }
    };
    
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require('pdf-parse');
    let pdfInfo;
    let content = '';
    let numPages = 0;
    
    try {
      pdfInfo = await pdfParse(dataBuffer);
      console.warn = originalWarn;
      
      if (pdfInfo.text && pdfInfo.text.trim().length > 0) {
        // PDF has extractable text - use it directly
        content = pdfInfo.text;
        numPages = pdfInfo.numpages;
        const wordCount = content.split(/\s+/).length;
        console.log(`   ✓ Extracted text (text-based PDF): ${numPages} pages, ${wordCount} words`);
      }
    } catch {
      console.warn = originalWarn;
      // pdf-parse failed, continue with OCR
    }
    
    // If no text extracted, use OCR
    if (content.length === 0) {
      console.log(`   🔍 Using OCR (image-based PDF)...`);
      
      // Dynamically import pdfjs-dist
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
      
      // Get page count
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;
      numPages = pdf.numPages;
      
      // Initialize Tesseract.js with French language support
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createWorker } = require('tesseract.js');
      const worker = await createWorker('fra');
      
      // Configure character whitelist
      const charWhitelist = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789éèêàçùôûîïüëÉÈÊÀÇÙÔÛÎÏÜËœŒ.,-/() :\'';
      await worker.setParameters({
        tessedit_char_whitelist: charWhitelist,
      });
      
      const allText: string[] = [];
      
      // Process each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          console.log(`   📖 Processing page ${pageNum}/${numPages}...`);
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 });
          
          // Create canvas for rendering
          const canvas = createCanvas(viewport.width, viewport.height);
          const context = canvas.getContext('2d') as any;
          
          // Render PDF page to canvas
          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };
          
          await page.render(renderContext).promise;
          
          // Convert canvas to image buffer
          const imageBuffer = canvas.toBuffer('image/png');
          
          // Run OCR
          const { data: { text } } = await worker.recognize(imageBuffer);
          
          if (text && text.trim().length > 0) {
            // Apply OCR corrections
            const correctedText = correctOCRText(text.trim());
            const pageText = `[Page ${pageNum}]\n${correctedText}`;
            allText.push(pageText);
          }
        } catch (pageError) {
          console.warn(`   ⚠️  Error processing page ${pageNum}: ${pageError instanceof Error ? pageError.message : String(pageError)}`);
        }
      }
      
      // Terminate worker
      await worker.terminate();
      
      content = allText.join('\n\n---\n\n');
    }
    
    // Save to .txt file
    if (content.length > 0) {
      fs.writeFileSync(outputPath, content, 'utf8');
      const wordCount = content.split(/\s+/).length;
      console.log(`   ✅ Saved: ${path.basename(outputPath)} (${numPages} pages, ${wordCount} words)`);
      return { success: true, outputPath };
    } else {
      return { success: false, error: 'No text extracted from PDF' };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Error: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}

/**
 * Get all PDF files from a directory
 */
function getPDFsFromFolder(folderPath: string): string[] {
  const pdfs: string[] = [];
  
  if (!fs.existsSync(folderPath)) {
    return pdfs;
  }
  
  const items = fs.readdirSync(folderPath);
  
  for (const item of items) {
    const fullPath = path.join(folderPath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Recursively search subdirectories
      pdfs.push(...getPDFsFromFolder(fullPath));
    } else if (item.toLowerCase().endsWith('.pdf')) {
      pdfs.push(fullPath);
    }
  }
  
  return pdfs;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📄 PDF-OCR Processor

Converts PDF files to .txt files using OCR.

Usage:
  tsx scripts/process-pdf-ocr.ts <file1.pdf> [file2.pdf ...]
  tsx scripts/process-pdf-ocr.ts <folder>
  tsx scripts/process-pdf-ocr.ts <file1.pdf> <file2.pdf> <folder>

Examples:
  tsx scripts/process-pdf-ocr.ts document.pdf
  tsx scripts/process-pdf-ocr.ts data/scraped/pdfs/
  tsx scripts/process-pdf-ocr.ts file1.pdf file2.pdf data/scraped/pdfs/

Output: .txt files saved to data/scraped/pdf-texts/
`);
    process.exit(1);
  }
  
  // Collect all PDF files
  const pdfFiles: string[] = [];
  
  for (const arg of args) {
    const resolvedPath = path.resolve(process.cwd(), arg);
    
    if (!fs.existsSync(resolvedPath)) {
      console.warn(`⚠️  Path not found: ${arg}`);
      continue;
    }
    
    const stat = fs.statSync(resolvedPath);
    
    if (stat.isDirectory()) {
      // Add all PDFs from folder
      const folderPDFs = getPDFsFromFolder(resolvedPath);
      pdfFiles.push(...folderPDFs);
      console.log(`📁 Found ${folderPDFs.length} PDF(s) in folder: ${arg}`);
    } else if (resolvedPath.toLowerCase().endsWith('.pdf')) {
      // Add single PDF file
      pdfFiles.push(resolvedPath);
    } else {
      console.warn(`⚠️  Not a PDF file: ${arg}`);
    }
  }
  
  if (pdfFiles.length === 0) {
    console.error('❌ No PDF files found to process.');
    process.exit(1);
  }
  
  console.log(`\n🚀 Processing ${pdfFiles.length} PDF file(s)...\n`);
  
  // Process all PDFs
  let successCount = 0;
  let failCount = 0;
  
  for (const pdfFile of pdfFiles) {
    const result = await processPDF(pdfFile);
    if (result.success) {
      successCount++;
    } else {
      failCount++;
      console.error(`   ❌ Failed: ${result.error}`);
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Success: ${successCount}`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount}`);
  }
  console.log(`📁 Output folder: ${getOutputDir()}`);
  console.log(`${'='.repeat(50)}\n`);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}






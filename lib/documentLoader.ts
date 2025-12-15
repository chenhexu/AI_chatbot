import { documentProcessorRegistry, type DocumentSource } from './documentProcessors';
import { FileProcessor } from './documentProcessors/fileProcessor';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Find the original PDF file for a PDF text file
 * PDF text files are named like: {pdfName}_{hash}.txt
 * We try to find the matching PDF in the pdfs/ folder
 */
function findOriginalPDF(pdfTextPath: string, baseDir: string): string | null {
  try {
    const textFileName = path.basename(pdfTextPath, '.txt');
    const pdfsDir = path.join(baseDir, 'pdfs');
    if (!fs.existsSync(pdfsDir)) return null;
    
    const pdfFiles = fs.readdirSync(pdfsDir).filter(f => f.endsWith('.pdf'));
    if (pdfFiles.length === 0) return null;
    
    // Strategy 1: Try to match by removing the hash (last part after underscore)
    // Format: {pdfName}_{hash}.txt
    const parts = textFileName.split('_');
    if (parts.length >= 2) {
      // Remove the hash (last part) and try to match
      const nameWithoutHash = parts.slice(0, -1).join('_');
      
      // Try exact or near-exact match
      for (const pdfFile of pdfFiles) {
        const pdfName = path.basename(pdfFile, '.pdf');
        // Normalize both names for comparison (remove special chars, lowercase)
        const normalizedTextName = nameWithoutHash.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedPdfName = pdfName.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Check if one contains the other (allowing for some variation)
        if (normalizedTextName.includes(normalizedPdfName) || 
            normalizedPdfName.includes(normalizedTextName) ||
            normalizedTextName === normalizedPdfName) {
          return path.join('pdfs', pdfFile).replace(/\\/g, '/');
        }
      }
      
      // Strategy 2: Try matching by significant words (longer than 4 chars)
      const significantWords = nameWithoutHash.split('_').filter(w => w.length > 4);
      for (const word of significantWords) {
        for (const pdfFile of pdfFiles) {
          const pdfName = path.basename(pdfFile, '.pdf');
          if (pdfName.toLowerCase().includes(word.toLowerCase()) || 
              word.toLowerCase().includes(pdfName.toLowerCase())) {
            return path.join('pdfs', pdfFile).replace(/\\/g, '/');
          }
        }
      }
    }
    
    // Strategy 3: If text file name is very short or doesn't match, try fuzzy matching
    // by checking if any PDF name contains significant parts of the text file name
    const allWords = textFileName.split('_').filter(w => w.length > 3);
    for (const word of allWords) {
      for (const pdfFile of pdfFiles) {
        const pdfName = path.basename(pdfFile, '.pdf');
        if (pdfName.toLowerCase().includes(word.toLowerCase())) {
          return path.join('pdfs', pdfFile).replace(/\\/g, '/');
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding original PDF:', error);
    return null;
  }
}

/**
 * Document Loader - High-level interface for loading documents
 * This is the main entry point for adding document sources
 * 
 * Usage:
 * - Add new document sources here
 * - The processor registry will automatically handle different formats
 * - RAG system receives clean, raw text regardless of source
 */
export async function loadAllDocuments(): Promise<Array<{ id: string; content: string; pdfUrl?: string }>> {
  const sources: DocumentSource[] = [];
  
  // Google Docs
  const googleDocId = process.env.GOOGLE_DOC_FULL_ID;
  if (googleDocId) {
    sources.push({
      id: googleDocId,
      type: 'google-doc',
      name: 'Information Feed - Full Document',
    });
  }

  // Scraped files from website crawler
  const scrapedDataFolder = process.env.CRAWLER_DATA_FOLDER || './data/scraped';
  const scrapedFiles = FileProcessor.getAvailableFiles(scrapedDataFolder);
  
  // Count files as we process them (more reliable than filtering later)
  let pageCount = 0;
  let pdfTextCount = 0;
  let excelCount = 0;
  let externalCount = 0;
  
  for (const file of scrapedFiles) {
    // Process text files from pages folder
    if (file.category === 'pages' && file.path.endsWith('.txt')) {
      sources.push({
        id: `file://${file.path.replace(/\\/g, '/')}`, // Normalize to forward slashes
        type: 'text',
        name: `Scraped Page: ${path.basename(file.path)}`,
      });
      pageCount++;
    }
    // Process external pages (from external websites)
    else if (file.category === 'external' && file.path.endsWith('.txt')) {
      sources.push({
        id: `file://${file.path.replace(/\\/g, '/')}`, // Normalize to forward slashes
        type: 'text',
        name: `External Page: ${path.basename(file.path)}`,
      });
      externalCount++;
    }
    // Process PDF text files (OCR results saved as .txt)
    // NOTE: We only use .txt files from pdf-texts folder, NOT the original PDFs
    // This avoids duplicate processing since PDFs are already converted to .txt
    else if (file.category === 'pdf-texts' && file.path.endsWith('.txt')) {
      sources.push({
        id: `file://${file.path.replace(/\\/g, '/')}`, // Normalize to forward slashes
        type: 'text',
        name: `PDF Text: ${path.basename(file.path)}`,
      });
      pdfTextCount++;
    }
    // PDFs from pdfs/ folder are NOT loaded - we only use pre-processed .txt files from pdf-texts/
    // Process Excel files (when processor is implemented)
    else if (file.category === 'excel' && (file.path.endsWith('.xlsx') || file.path.endsWith('.xls'))) {
      sources.push({
        id: `file://${file.path.replace(/\\/g, '/')}`,
        type: 'excel',
        name: `Scraped Excel: ${path.basename(file.path)}`,
      });
      excelCount++;
    }
  }
  
  // Filter out empty IDs
  const validSources = sources.filter(source => source.id);

  // Log what we're loading
  const googleDocCount = validSources.filter(s => s.type === 'google-doc').length;
  
  console.log(`📚 Loading documents:`);
  console.log(`   - Google Docs: ${googleDocCount}`);
  console.log(`   - Scraped Pages: ${pageCount}`);
  console.log(`   - External Pages: ${externalCount}`);
  console.log(`   - PDF Texts (OCR): ${pdfTextCount} ${pdfTextCount > 0 ? '✅' : '⚠️'}`);
  console.log(`   - Scraped Excel: ${excelCount}`);
  console.log(`   - Total: ${validSources.length} sources\n`);

  // Process all documents using the registry
  // This converts any format to raw text
  const processedDocuments = await documentProcessorRegistry.processAll(validSources);

  // Return in format expected by RAG system
  // Include PDF URLs for PDF text files
  return processedDocuments.map(doc => {
    const result: { id: string; content: string; pdfUrl?: string } = {
      id: doc.id,
      content: doc.content,
    };
    
    // If this is a PDF text file, find the original PDF
    if (doc.id.startsWith('file://') && doc.id.includes('pdf-texts/')) {
      const textFilePath = doc.id.replace('file://', '').replace(/\//g, path.sep);
      const originalPDF = findOriginalPDF(textFilePath, scrapedDataFolder);
      if (originalPDF) {
        result.pdfUrl = `file://${originalPDF}`;
      }
    }
    
    return result;
  });
}


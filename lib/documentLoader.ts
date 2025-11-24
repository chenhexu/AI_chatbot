import { documentProcessorRegistry, type DocumentSource } from './documentProcessors';
import { FileProcessor } from './documentProcessors/fileProcessor';
import * as path from 'path';

/**
 * Document Loader - High-level interface for loading documents
 * This is the main entry point for adding document sources
 * 
 * Usage:
 * - Add new document sources here
 * - The processor registry will automatically handle different formats
 * - RAG system receives clean, raw text regardless of source
 */
export async function loadAllDocuments(): Promise<Array<{ id: string; content: string }>> {
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
  let pdfCount = 0;
  let excelCount = 0;
  let externalCount = 0;
  
  for (const file of scrapedFiles) {
    // Process text files from pages folder
    if (file.category === 'pages' && file.path.endsWith('.txt')) {
      sources.push({
        id: `file://${file.path.replace(/\\/g, '/')}`, // Normalize to forward slashes
        type: 'file',
        name: `Scraped Page: ${path.basename(file.path)}`,
      });
      pageCount++;
    }
    // Process external pages (from external websites)
    else if (file.category === 'external' && file.path.endsWith('.txt')) {
      sources.push({
        id: `file://${file.path.replace(/\\/g, '/')}`, // Normalize to forward slashes
        type: 'file',
        name: `External Page: ${path.basename(file.path)}`,
      });
      externalCount++;
    }
    // Process PDF files
    else if (file.category === 'pdfs' && file.path.endsWith('.pdf')) {
      sources.push({
        id: `file://${file.path.replace(/\\/g, '/')}`, // Normalize to forward slashes
        type: 'pdf',
        name: `Scraped PDF: ${path.basename(file.path)}`,
      });
      pdfCount++;
    }
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
  console.log(`   - Scraped PDFs: ${pdfCount}`);
  console.log(`   - Scraped Excel: ${excelCount}`);
  console.log(`   - Total: ${validSources.length} sources\n`);

  // Process all documents using the registry
  // This converts any format to raw text
  const processedDocuments = await documentProcessorRegistry.processAll(validSources);

  // Return in format expected by RAG system
  // RAG doesn't care about the source - it just gets raw text!
  return processedDocuments.map(doc => ({
    id: doc.id,
    content: doc.content,
  }));
}


import * as fs from 'fs';
import * as path from 'path';
import { DocumentProcessor, DocumentSource, ProcessedDocument } from './types';
import { createCanvas } from 'canvas';
import { correctOCRText } from '../ocrCorrector';
import * as crypto from 'crypto';

/**
 * Get cache directory path for OCR results (as .txt files)
 */
function getCacheDir(): string {
  const baseDir = process.env.CRAWLER_DATA_FOLDER || './data/scraped';
  const cacheDir = path.resolve(process.cwd(), baseDir, 'pdf-texts');
  
  // Ensure cache directory exists
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  
  return cacheDir;
}

/**
 * Generate cache key from file path and modification time
 */
function getCacheKey(filePath: string): string {
  const stats = fs.statSync(filePath);
  const fileInfo = `${filePath}:${stats.mtime.getTime()}:${stats.size}`;
  return crypto.createHash('md5').update(fileInfo).digest('hex');
}

/**
 * Get cache file path for a PDF (as .txt file)
 */
function getCacheFilePath(filePath: string): string {
  const cacheKey = getCacheKey(filePath);
  const cacheDir = getCacheDir();
  // Use the original PDF filename (without extension) + cache key for uniqueness
  const pdfName = path.basename(filePath, '.pdf');
  const safeName = pdfName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(cacheDir, `${safeName}_${cacheKey}.txt`);
}

/**
 * Load OCR result from cache if available
 */
function loadFromCache(filePath: string): ProcessedDocument | null {
  try {
    const cacheFile = getCacheFilePath(filePath);
    if (fs.existsSync(cacheFile)) {
      // Read as plain text file
      const content = fs.readFileSync(cacheFile, 'utf8');
      if (content.trim().length > 0) {
        // Return as ProcessedDocument (we don't have metadata in .txt, but that's okay)
        return {
          id: `file://pdf-texts/${path.basename(cacheFile)}`,
          content: content,
          source: {
            id: `file://pdf-texts/${path.basename(cacheFile)}`,
            type: 'text',
            name: `PDF Text: ${path.basename(filePath)}`,
          },
          metadata: {
            wordCount: content.split(/\s+/).length,
            processedAt: new Date(),
          },
        };
      }
    }
  } catch (error) {
    // Cache file corrupted or invalid, ignore and re-process
  }
  return null;
}

/**
 * Save OCR result to cache as .txt file
 */
function saveToCache(filePath: string, result: ProcessedDocument): void {
  try {
    const cacheFile = getCacheFilePath(filePath);
    // Save only the content as plain text (like pages folder)
    fs.writeFileSync(cacheFile, result.content, 'utf8');
  } catch (error) {
    // Cache write failed, but don't fail the whole process
    console.warn(`   ⚠️  Failed to save OCR cache for ${path.basename(filePath)}`);
  }
}

/**
 * Processor for PDF files using OCR (Tesseract.js)
 * Handles scanned/image-based PDFs that cannot be read with standard text extraction
 */
export class PDFProcessor implements DocumentProcessor {
  canProcess(source: DocumentSource): boolean {
    return source.type === 'pdf' || source.id.endsWith('.pdf');
  }

  async process(source: DocumentSource): Promise<ProcessedDocument> {
    let filePath: string;
    
    if (source.id.startsWith('file://')) {
      // File path from scraped folder
      // Normalize path separators (handle both / and \)
      const relativePath = source.id.replace('file://', '').replace(/\//g, path.sep);
      filePath = path.resolve(process.cwd(), process.env.CRAWLER_DATA_FOLDER || './data/scraped', relativePath);
    } else {
      // Direct file path
      filePath = path.resolve(process.cwd(), source.id);
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`PDF file not found (source: ${source.id}, path: ${filePath})`);
    }

    // Check cache first (for OCR results)
    const cached = loadFromCache(filePath);
    if (cached) {
      // Update source to match current request
      cached.source = source;
      cached.id = source.id; // Keep original source ID
      // Update processedAt to current time
      if (cached.metadata) {
        cached.metadata.processedAt = new Date();
      }
      // Silent cache hit - no logging to reduce verbosity
      return cached;
    }

    try {
      const dataBuffer = fs.readFileSync(filePath);
      const uint8Array = new Uint8Array(dataBuffer);
      
      // First, try pdf-parse to see if PDF has extractable text (faster)
      // Suppress pdf-parse warnings about font issues (they're harmless)
      const originalWarn = console.warn;
      console.warn = (...args: any[]) => {
        const msg = args[0]?.toString() || '';
        // Suppress pdf-parse font warnings
        if (!msg.includes('Warning: TT:') && !msg.includes('undefined function')) {
          originalWarn(...args);
        }
      };
      
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require('pdf-parse');
      let pdfInfo;
      try {
        pdfInfo = await pdfParse(dataBuffer);
        // Restore console.warn
        console.warn = originalWarn;
        
        if (pdfInfo.text && pdfInfo.text.trim().length > 0) {
          // PDF has extractable text - use it directly (much faster)
          const wordCount = pdfInfo.text.split(/\s+/).length;
          const result = {
            id: source.id,
            content: pdfInfo.text,
            source,
            metadata: {
              pageCount: pdfInfo.numpages,
              wordCount: wordCount,
              processedAt: new Date(),
            },
          };
          
          // Cache the result as .txt file
          saveToCache(filePath, result);
          
          // Silent success for text-based PDFs - only log errors
          return result;
        }
      } catch {
        // Restore console.warn even on error
        console.warn = originalWarn;
        // pdf-parse failed, continue with OCR
      }
      
      // PDF has no extractable text or pdf-parse failed - use OCR
      // Dynamically import pdfjs-dist legacy build (Node.js compatible)
      // Construct path dynamically to avoid Next.js static analysis
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfjsPath = ['pdfjs-dist', 'legacy', 'build', 'pdf.js'].join('/');
      const pdfjsLib = require(pdfjsPath);
      
      // Get page count first - convert Buffer to Uint8Array
      const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      // Initialize Tesseract.js with French language support
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createWorker } = require('tesseract.js');
      const worker = await createWorker('fra'); // French language
      
      // Configure character whitelist to improve OCR accuracy
      // Only recognize letters (including French accents), numbers, and common punctuation
      // This prevents OCR from recognizing garbage characters and improves accuracy
      // Based on user suggestion: restrict to essential characters only
      // User's exact suggestion: abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789éèêàçù.,-/
      // Added: more French accents (ô, û, î, ï, ü, ë), uppercase accents, space, parentheses, colon, apostrophe, and œ ligature
      const charWhitelist = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789éèêàçùôûîïüëÉÈÊÀÇÙÔÛÎÏÜËœŒ.,-/() :\'';
      
      // Set the whitelist parameter - this tells Tesseract to ONLY recognize these characters
      // This significantly reduces garbage characters in OCR output
      await worker.setParameters({
        tessedit_char_whitelist: charWhitelist,
      });

      const allText: string[] = [];

      // Process each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR accuracy

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

          // Ensure whitelist is applied (setParameters should persist, but we verify)
          // This restricts OCR to only recognize: letters, numbers, French accents, and basic punctuation
          // This prevents garbage characters like "SuagesHoN", "œxscilère", etc.
          
          // Run OCR on the image with whitelist restriction
          const { data: { text } } = await worker.recognize(imageBuffer, {
            // Additional options can be passed here if needed
          });
          
          if (text && text.trim().length > 0) {
            // Apply OCR corrections to fix common errors
            const correctedText = correctOCRText(text.trim());
            const pageText = `[Page ${pageNum}]\n${correctedText}`;
            allText.push(pageText);
          }
        } catch (pageError) {
          console.warn(`⚠️  Error processing page ${pageNum} of ${path.basename(filePath)}: ${pageError instanceof Error ? pageError.message : String(pageError)}`);
          // Continue with next page
        }
      }

      // Terminate worker
      await worker.terminate();

      const content = allText.join('\n\n---\n\n');
      const wordCount = content.split(/\s+/).length;

      // Only log errors, not successes (to reduce verbosity)
      if (content.length === 0) {
        console.warn(`   ⚠️  PDF OCR extracted no text: ${path.basename(filePath)}`);
      }

      const result = {
        id: source.id,
        content,
        source,
        metadata: {
          pageCount: numPages,
          wordCount: wordCount,
          processedAt: new Date(),
        },
      };

      // Save to cache as .txt file for future use
      saveToCache(filePath, result);

      return result;
    } catch (error) {
      // Catch any errors and return empty content gracefully
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️  PDF OCR error (skipping): ${path.basename(filePath)} - ${errorMsg.substring(0, 100)}`);
      
      return {
        id: source.id,
        content: '',
        source,
        metadata: {
          pageCount: 0,
          wordCount: 0,
          processedAt: new Date(),
        },
      };
    }
  }
}

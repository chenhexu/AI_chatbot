import * as fs from 'fs';
import * as path from 'path';
import { DocumentProcessor, DocumentSource, ProcessedDocument } from './types';

// pdf-parse will be imported dynamically

/**
 * Processor for PDF files
 */
export class PDFProcessor implements DocumentProcessor {
  canProcess(source: DocumentSource): boolean {
    return source.type === 'pdf' || (source.type === 'file' && source.id.endsWith('.pdf'));
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

    try {
      const dataBuffer = fs.readFileSync(filePath);
      // pdf-parse v1.1.1 uses function API (only runs server-side in API routes)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require('pdf-parse');
      
      // Completely suppress stderr and console output during PDF parsing to hide font warnings
      // These warnings are harmless but annoying - they come from pdf-parse's font parsing
      const originalStderrWrite = process.stderr.write.bind(process.stderr);
      const originalWarn = console.warn;
      const originalLog = console.log;
      const suppressedMessages: string[] = [];
      
      // Helper function to check if a message should be suppressed
      const shouldSuppress = (message: string): boolean => {
        const msg = message.toLowerCase();
        return msg.includes('tt:') || 
               msg.includes('undefined function') || 
               msg.includes('invalid function id') ||
               msg.trim().startsWith('warning: tt:');
      };
      
      // Intercept all stderr writes
      process.stderr.write = function(chunk: any, encoding?: any, callback?: any): boolean {
        const message = chunk?.toString() || '';
        if (shouldSuppress(message)) {
          suppressedMessages.push(message.trim());
          if (typeof callback === 'function') {
            callback();
          }
          return true;
        }
        return originalStderrWrite(chunk, encoding, callback);
      };
      
      // Intercept console.warn
      console.warn = function(...args: any[]): void {
        const message = args.join(' ');
        if (shouldSuppress(message)) {
          return; // Suppress
        }
        originalWarn.apply(console, args);
      };
      
      // Intercept console.log (pdf-parse uses console.log for warnings)
      console.log = function(...args: any[]): void {
        const message = args.join(' ');
        if (shouldSuppress(message)) {
          return; // Suppress
        }
        originalLog.apply(console, args);
      };
      
      // pdf-parse is callable directly as a function
      // Wrap in try-catch to handle any internal test file access errors
      let pdfData;
      try {
        pdfData = await pdfParse(dataBuffer);
      } catch (parseError) {
        // Restore before handling error
        process.stderr.write = originalStderrWrite;
        console.warn = originalWarn;
        console.log = originalLog;
        
        // If pdf-parse tries to access test files or has other issues, skip this PDF
        if (parseError instanceof Error && parseError.message.includes('ENOENT')) {
          console.warn(`Skipping PDF (source: ${source.id}, path: ${filePath}): ${parseError.message}`);
          // Return empty content rather than failing
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
        throw parseError;
      } finally {
        // Always restore, even on success
        process.stderr.write = originalStderrWrite;
        console.warn = originalWarn;
        console.log = originalLog;
      }
      
      // Extract text content
      const content = pdfData.text;
      
      return {
        id: source.id,
        content,
        source,
        metadata: {
          pageCount: pdfData.numpages,
          wordCount: content.split(/\s+/).length,
          processedAt: new Date(),
        },
      };
    } catch (error) {
      throw new Error(`Error parsing PDF (source: ${source.id}, path: ${filePath}): ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}


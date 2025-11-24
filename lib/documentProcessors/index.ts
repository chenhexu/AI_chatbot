import { DocumentProcessor, DocumentSource, ProcessedDocument } from './types';
import { GoogleDocsProcessor } from './googleDocsProcessor';
import { PDFProcessor } from './pdfProcessor';
import { ExcelProcessor } from './excelProcessor';
import { TextProcessor } from './textProcessor';
import { FileProcessor } from './fileProcessor';

/**
 * Document Processor Registry
 * Add new processors here to support new document types
 */
class DocumentProcessorRegistry {
  private processors: DocumentProcessor[] = [];

  constructor() {
    // Register all available processors
    this.register(new GoogleDocsProcessor());
    this.register(new PDFProcessor());
    this.register(new ExcelProcessor());
    this.register(new TextProcessor());
    this.register(new FileProcessor());
  }

  /**
   * Register a new document processor
   */
  register(processor: DocumentProcessor): void {
    this.processors.push(processor);
  }

  /**
   * Find the appropriate processor for a document source
   */
  findProcessor(source: DocumentSource): DocumentProcessor {
    const processor = this.processors.find(p => p.canProcess(source));
    
    if (!processor) {
      throw new Error(`No processor found for document type: ${source.type}`);
    }
    
    return processor;
  }

  /**
   * Process a document source using the appropriate processor
   */
  async process(source: DocumentSource): Promise<ProcessedDocument> {
    const processor = this.findProcessor(source);
    return processor.process(source);
  }

  /**
   * Process multiple document sources
   */
  async processAll(sources: DocumentSource[]): Promise<ProcessedDocument[]> {
    const results = await Promise.allSettled(
      sources.map(source => this.process(source))
    );

    const processed: ProcessedDocument[] = [];
    const errors: Error[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        // Only add documents with content (skip empty ones from graceful failures)
        if (result.value.content && result.value.content.trim().length > 0) {
          processed.push(result.value);
        }
      } else {
        // Only log errors that aren't expected (like missing service account)
        const errorMsg = result.reason?.message || String(result.reason);
        const sourceId = sources[index].id;
        if (!errorMsg.includes('Service account') && !errorMsg.includes('not configured')) {
          // Log full source ID without truncation
          console.error(`Error processing document (full source: ${sourceId}):`, result.reason);
        }
        errors.push(new Error(`Failed to process ${sourceId}: ${errorMsg}`));
      }
    });

    if (errors.length > 0 && processed.length === 0) {
      throw new Error(`All documents failed to process: ${errors.map(e => e.message).join(', ')}`);
    }

    return processed;
  }
}

// Export singleton instance
export const documentProcessorRegistry = new DocumentProcessorRegistry();

// Export types for convenience
export type { DocumentSource, ProcessedDocument, DocumentProcessor };


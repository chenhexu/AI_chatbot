/**
 * Common interface for all document processors
 * This allows RAG to work with any document source without knowing the format
 */
export interface DocumentSource {
  id: string;
  type: 'google-doc' | 'pdf' | 'excel' | 'word' | 'text' | 'url';
  name?: string;
}

export interface ProcessedDocument {
  id: string;
  content: string;
  source: DocumentSource;
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    processedAt?: Date;
  };
}

/**
 * Base interface for document processors
 */
export interface DocumentProcessor {
  /**
   * Check if this processor can handle the given source
   */
  canProcess(source: DocumentSource): boolean;

  /**
   * Process a document source and return raw text
   */
  process(source: DocumentSource): Promise<ProcessedDocument>;
}


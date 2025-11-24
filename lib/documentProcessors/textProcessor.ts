import { DocumentProcessor, DocumentSource, ProcessedDocument } from './types';

/**
 * Processor for plain text content
 * Useful for direct text input or pre-processed content
 */
export class TextProcessor implements DocumentProcessor {
  canProcess(source: DocumentSource): boolean {
    return source.type === 'text';
  }

  async process(source: DocumentSource): Promise<ProcessedDocument> {
    // For text type, the content should be in source.id or a data field
    // This is a simple implementation - you might want to store text differently
    const content = (source as any).content || source.id || '';
    
    return {
      id: source.id,
      content,
      source,
      metadata: {
        wordCount: content.split(/\s+/).length,
        processedAt: new Date(),
      },
    };
  }
}


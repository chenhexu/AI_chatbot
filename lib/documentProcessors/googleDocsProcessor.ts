import { DocumentProcessor, DocumentSource, ProcessedDocument } from './types';
import { fetchGoogleDocContent } from '../googleDocs';

/**
 * Processor for Google Docs
 */
export class GoogleDocsProcessor implements DocumentProcessor {
  canProcess(source: DocumentSource): boolean {
    return source.type === 'google-doc';
  }

  async process(source: DocumentSource): Promise<ProcessedDocument> {
    if (!source.id) {
      throw new Error('Google Doc source must have an id');
    }

    try {
      const content = await fetchGoogleDocContent(source.id);
      
      return {
        id: source.id,
        content,
        source,
        metadata: {
          wordCount: content.split(/\s+/).length,
          processedAt: new Date(),
        },
      };
    } catch (error) {
      // If service account is missing or other error, return empty content
      // This allows the system to continue with other documents
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('Service account key file not found') || 
          errorMessage.includes('GOOGLE_SERVICE_ACCOUNT')) {
        console.warn(`⚠️  Skipping Google Doc ${source.id}: Service account not configured (this is OK if you're only using scraped content)`);
        return {
          id: source.id,
          content: '',
          source,
          metadata: {
            wordCount: 0,
            processedAt: new Date(),
          },
        };
      }
      // Re-throw other errors
      throw error;
    }
  }
}


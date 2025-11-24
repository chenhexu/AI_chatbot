import { DocumentProcessor, DocumentSource, ProcessedDocument } from './types';

/**
 * Processor for Excel files
 * TODO: Implement Excel parsing (using xlsx or similar library)
 */
export class ExcelProcessor implements DocumentProcessor {
  canProcess(source: DocumentSource): boolean {
    return source.type === 'excel';
  }

  async process(source: DocumentSource): Promise<ProcessedDocument> {
    // TODO: Implement Excel parsing
    // You can use libraries like:
    // - xlsx (npm install xlsx)
    // - exceljs (npm install exceljs)
    
    throw new Error('Excel processing not yet implemented. Install xlsx and implement this processor.');
  }
}


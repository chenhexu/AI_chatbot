import * as fs from 'fs';
import * as path from 'path';
import { DocumentProcessor, DocumentSource, ProcessedDocument } from './types';

/**
 * Processor for files stored in the scraped data folder
 * Reads files from data/scraped/ directory
 */
export class FileProcessor implements DocumentProcessor {
  private baseDir: string;

  constructor(baseDir?: string) {
    // Use the same baseDir as documentLoader for consistency
    const defaultDir = process.env.CRAWLER_DATA_FOLDER || './data/scraped';
    this.baseDir = path.resolve(process.cwd(), baseDir || defaultDir);
  }

  canProcess(source: DocumentSource): boolean {
    // Prioritize file:// URLs - this processor handles actual file reading
    // Must come before TextProcessor in registry order
    if (source.id.startsWith('file://')) {
      return true;
    }
    // Also handle text type if it's a file path (fallback)
    return source.type === 'text' && source.id.includes('/') && !source.id.startsWith('http');
  }

  async process(source: DocumentSource): Promise<ProcessedDocument> {
    // Extract file path from source ID (format: file://path/to/file)
    // Normalize path separators (handle both / and \)
    const filePath = source.id.replace('file://', '').replace(/\//g, path.sep);
    const fullPath = path.resolve(this.baseDir, filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found (source: ${source.id}, path: ${fullPath})`);
    }

    // Read file content - keep all content, let RAG similarity matching filter
    const content = fs.readFileSync(fullPath, 'utf8');
    
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

  /**
   * Get all available files in the scraped folder
   */
  static getAvailableFiles(baseDir?: string): Array<{ path: string; category: string }> {
    // Use the same baseDir as documentLoader for consistency
    const defaultDir = process.env.CRAWLER_DATA_FOLDER || './data/scraped';
    const resolvedDir = path.resolve(process.cwd(), baseDir || defaultDir);
    const files: Array<{ path: string; category: string }> = [];

    if (!fs.existsSync(resolvedDir)) {
      return files;
    }

    const categories = ['pages', 'pdfs', 'pdf-texts', 'excel', 'images', 'other', 'external'];
    
    for (const category of categories) {
      const categoryDir = path.join(resolvedDir, category);
      if (fs.existsSync(categoryDir)) {
        const categoryFiles = fs.readdirSync(categoryDir)
          .filter(file => !file.startsWith('.'))
          .map(file => ({
            path: path.join(category, file),
            category,
          }));
        files.push(...categoryFiles);
      }
    }

    return files;
  }
}


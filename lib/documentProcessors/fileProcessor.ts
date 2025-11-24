import * as fs from 'fs';
import * as path from 'path';
import { DocumentProcessor, DocumentSource, ProcessedDocument } from './types';

/**
 * Processor for files stored in the scraped data folder
 * Reads files from data/scraped/ directory
 */
export class FileProcessor implements DocumentProcessor {
  private baseDir: string;

  constructor(baseDir: string = './data/scraped') {
    this.baseDir = path.resolve(process.cwd(), baseDir);
  }

  canProcess(source: DocumentSource): boolean {
    return source.type === 'file' || (source.type === 'url' && source.id.startsWith('file://'));
  }

  async process(source: DocumentSource): Promise<ProcessedDocument> {
    // Extract file path from source ID (format: file://path/to/file)
    // Normalize path separators (handle both / and \)
    const filePath = source.id.replace('file://', '').replace(/\//g, path.sep);
    const fullPath = path.resolve(this.baseDir, filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found (source: ${source.id}, path: ${fullPath})`);
    }

    // Read file content
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
  static getAvailableFiles(baseDir: string = './data/scraped'): Array<{ path: string; category: string }> {
    const resolvedDir = path.resolve(process.cwd(), baseDir);
    const files: Array<{ path: string; category: string }> = [];

    if (!fs.existsSync(resolvedDir)) {
      return files;
    }

    const categories = ['pages', 'pdfs', 'excel', 'images', 'other', 'external'];
    
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


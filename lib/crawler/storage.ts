import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface CrawlMetadata {
  url: string;
  crawledAt: Date;
  contentHash: string;
  filePath: string;
}

export interface CrawlIndex {
  lastCrawl: Date;
  pages: CrawlMetadata[];
  pdfs: CrawlMetadata[];
  excel: CrawlMetadata[];
  images: CrawlMetadata[];
  otherFiles: CrawlMetadata[];
}

/**
 * Manages storage of crawled content
 */
export class StorageManager {
  private baseDir: string;

  constructor(baseDir: string = './data/scraped') {
    this.baseDir = path.resolve(process.cwd(), baseDir);
    this.ensureDirectories();
  }

  /**
   * Ensure all necessary directories exist
   */
  private ensureDirectories(): void {
    const dirs = [
      this.baseDir,
      path.join(this.baseDir, 'pages'),
      path.join(this.baseDir, 'pdfs'),
      path.join(this.baseDir, 'excel'),
      path.join(this.baseDir, 'images'),
      path.join(this.baseDir, 'other'),
      path.join(this.baseDir, 'external'), // For external website pages
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Generate a safe filename from URL
   */
  private urlToFilename(url: string, extension: string = '.txt'): string {
    try {
      const urlObj = new URL(url);
      let filename = urlObj.pathname
        .replace(/^\//, '')
        .replace(/\//g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 200); // Limit length

      if (!filename) {
        filename = 'index';
      }

      // Add hash to ensure uniqueness
      const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
      return `${filename}_${hash}${extension}`;
    } catch {
      const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 16);
      return `file_${hash}${extension}`;
    }
  }

  /**
   * Save HTML page as text
   */
  async savePage(url: string, text: string, isExternal: boolean = false): Promise<string> {
    const filename = this.urlToFilename(url, '.txt');
    const folder = isExternal ? 'external' : 'pages';
    const filePath = path.join(this.baseDir, folder, filename);
    
    fs.writeFileSync(filePath, text, 'utf8');
    return filePath;
  }

  /**
   * Download and save a file (PDF, Excel, image, etc.)
   */
  async saveFile(url: string, category: 'pdfs' | 'excel' | 'images' | 'other'): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Collège-Saint-Louis-Crawler/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const extension = path.extname(new URL(url).pathname) || this.getExtensionFromCategory(category);
      const filename = this.urlToFilename(url, extension);
      const filePath = path.join(this.baseDir, category, filename);

      fs.writeFileSync(filePath, Buffer.from(buffer));
      return filePath;
    } catch (error) {
      console.error(`Error saving file ${url}:`, error);
      throw error;
    }
  }

  /**
   * Get file extension from category
   */
  private getExtensionFromCategory(category: string): string {
    const extensions: { [key: string]: string } = {
      pdfs: '.pdf',
      excel: '.xlsx',
      images: '.png',
      other: '.bin',
    };
    return extensions[category] || '.bin';
  }

  /**
   * Calculate content hash
   */
  private calculateHash(content: string | Buffer): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Save crawl metadata/index
   */
  async saveIndex(index: CrawlIndex): Promise<void> {
    const indexPath = path.join(this.baseDir, 'metadata.json');
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  }

  /**
   * Load crawl metadata/index
   */
  async loadIndex(): Promise<CrawlIndex | null> {
    const indexPath = path.join(this.baseDir, 'metadata.json');
    
    if (!fs.existsSync(indexPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(indexPath, 'utf8');
      const index = JSON.parse(content);
      // Convert date strings back to Date objects
      index.lastCrawl = new Date(index.lastCrawl);
      index.pages = index.pages.map((p: any) => ({ ...p, crawledAt: new Date(p.crawledAt) }));
      return index;
    } catch (error) {
      console.error('Error loading index:', error);
      return null;
    }
  }

  /**
   * Check if a URL has been crawled (by checking if file exists)
   */
  hasBeenCrawled(url: string, category: 'pages' | 'pdfs' | 'excel' | 'images' | 'other' | 'external'): boolean {
    const filename = this.urlToFilename(url, category === 'pages' || category === 'external' ? '.txt' : '');
    const filePath = path.join(this.baseDir, category, filename);
    return fs.existsSync(filePath);
  }

  /**
   * Get base directory
   */
  getBaseDir(): string {
    return this.baseDir;
  }
}




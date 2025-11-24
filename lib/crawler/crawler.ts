import * as path from 'path';
import { RobotsParser } from './robotsParser';
import { ContentExtractor, type ExtractedContent } from './contentExtractor';
import { StorageManager, type CrawlIndex, type CrawlMetadata } from './storage';

export interface CrawlerConfig {
  startUrl: string;
  maxDepth?: number;
  maxPages?: number;
  rateLimitMs?: number;
  userAgent?: string;
  dataFolder?: string;
}

export interface CrawlResult {
  pagesCrawled: number;
  filesDownloaded: number;
  linksFound: number;
  errors: number;
}

/**
 * Main web crawler
 */
export class WebCrawler {
  private config: Required<CrawlerConfig>;
  private robotsParser: RobotsParser | null = null;
  private contentExtractor: ContentExtractor;
  private storage: StorageManager;
  private visitedUrls: Set<string> = new Set();
  private queue: Array<{ url: string; depth: number; isExternal?: boolean }> = [];
  
  /**
   * Normalize URL by removing fragments (e.g., #:~:text=...)
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove hash/fragment
      urlObj.hash = '';
      return urlObj.toString();
    } catch {
      return url;
    }
  }
  private results: CrawlResult = {
    pagesCrawled: 0,
    filesDownloaded: 0,
    linksFound: 0,
    errors: 0,
  };

  constructor(config: CrawlerConfig) {
    this.config = {
      maxDepth: 8, // Increased from 5 to crawl deeper
      maxPages: 2000, // Increased to crawl more pages
      rateLimitMs: 1000, // 1 second per request for faster crawling
      userAgent: 'Collège-Saint-Louis-Crawler/1.0',
      dataFolder: './data/scraped',
      ...config,
    };

    this.contentExtractor = new ContentExtractor(this.config.startUrl);
    this.storage = new StorageManager(this.config.dataFolder);
  }

  /**
   * Start crawling
   */
  async crawl(): Promise<CrawlResult> {
    console.log(`Starting crawl from: ${this.config.startUrl}`);
    console.log(`Max depth: ${this.config.maxDepth}, Max pages: ${this.config.maxPages}`);
    console.log(`Rate limit: ${this.config.rateLimitMs}ms between requests\n`);

    // Fetch and parse robots.txt
    // Note: We respect robots.txt for allowed/disallowed, but use our configured rate limit
    try {
      this.robotsParser = await RobotsParser.fetchRobotsTxt(this.config.startUrl);
      const robotsDelay = this.robotsParser.getCrawlDelay(this.config.userAgent);
      if (robotsDelay > 0) {
        console.log(`Robots.txt specifies crawl-delay of ${robotsDelay}s, but using configured rate limit of ${this.config.rateLimitMs}ms`);
      }
    } catch (error) {
      console.warn('Could not fetch robots.txt, using default settings');
    }

    // Initialize queue - always process main page first
    // Normalize the start URL to remove any fragments
    const normalizedStartUrl = this.normalizeUrl(this.config.startUrl);
    this.queue.push({ url: normalizedStartUrl, depth: 0, isExternal: false });

    // Track which URLs we've processed in this session (to avoid re-processing)
    const processedInSession = new Set<string>();

    // Process queue
    while (this.queue.length > 0 && this.results.pagesCrawled < this.config.maxPages) {
      const { url, depth, isExternal = false } = this.queue.shift()!;

      if (depth > this.config.maxDepth) {
        continue;
      }

      // Normalize URL (remove fragments) for checking
      const normalizedUrl = this.normalizeUrl(url);

      // Skip if already processed in this session
      if (processedInSession.has(normalizedUrl)) {
        continue;
      }

      // For external links, skip robots.txt check (we don't have their robots.txt)
      if (!isExternal) {
        // Check robots.txt only for internal links
        if (this.robotsParser && !this.robotsParser.isAllowed(normalizedUrl, this.config.userAgent)) {
          console.log(`Skipping ${normalizedUrl} (disallowed by robots.txt)`);
          processedInSession.add(normalizedUrl);
          continue;
        }
      }

      // Check if page was already crawled
      const category = isExternal ? 'external' : 'pages';
      const alreadyCrawled = this.storage.hasBeenCrawled(normalizedUrl, category);

      // TEMPORARY: Skip already-crawled pages entirely for this run
      // Set SKIP_CRAWLED_PAGES=true in env to enable this behavior
      const skipCrawled = process.env.SKIP_CRAWLED_PAGES === 'true';
      if (skipCrawled && alreadyCrawled) {
        processedInSession.add(normalizedUrl);
        continue; // Skip already-crawled pages entirely
      }

      try {
        await this.crawlPage(normalizedUrl, depth, alreadyCrawled, isExternal);
        processedInSession.add(normalizedUrl); // Mark as processed after crawling
        await this.delay(this.config.rateLimitMs);
      } catch (error) {
        console.error(`Error crawling ${normalizedUrl}:`, error);
        this.results.errors++;
        processedInSession.add(normalizedUrl); // Mark as processed even on error to avoid retrying
      }
    }

    // Save final index
    await this.saveCrawlIndex();

    console.log('\n=== Crawl Complete ===');
    console.log(`Pages crawled: ${this.results.pagesCrawled}`);
    console.log(`Files downloaded: ${this.results.filesDownloaded}`);
    console.log(`Links found: ${this.results.linksFound}`);
    console.log(`Errors: ${this.results.errors}`);

    return this.results;
  }

  /**
   * Crawl a single page
   * @param alreadyCrawled - Whether the page file already exists (we still extract links/PDFs)
   * @param isExternal - Whether this is an external website
   */
  private async crawlPage(url: string, depth: number, alreadyCrawled: boolean = false, isExternal: boolean = false): Promise<void> {
    const prefix = isExternal ? '[EXTERNAL]' : '';
    if (alreadyCrawled) {
      console.log(`${prefix} [Depth ${depth}] Re-checking: ${url} (to discover new links/PDFs)`);
    } else {
      if (isExternal) {
        console.log(`\n${prefix} [Depth ${depth}] 🚀 Crawling EXTERNAL site: ${url}`);
      } else {
        console.log(`${prefix} [Depth ${depth}] Crawling: ${url}`);
      }
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.config.userAgent,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const extracted = this.contentExtractor.extract(html, url);

      // Log what we found
      const linkCount = extracted.links.length + extracted.externalLinks.length;
      if (extracted.pdfs.length > 0 || extracted.excel.length > 0 || linkCount > 0) {
        console.log(`  Found: ${extracted.pdfs.length} PDF(s), ${extracted.excel.length} Excel, ${extracted.links.length} internal, ${extracted.externalLinks.length} external link(s)`);
      }

      // Save page text (skip if already exists)
      if (!alreadyCrawled) {
        const filePath = await this.storage.savePage(url, extracted.text, isExternal);
        this.results.pagesCrawled++;
        console.log(`  ✓ Saved page: ${path.basename(filePath)}`);
      } else {
        console.log(`  ⊘ Page already saved, but checking for new links/PDFs`);
      }

      // Download files (skip if already exists)
      for (const pdfUrl of extracted.pdfs) {
        if (!this.storage.hasBeenCrawled(pdfUrl, 'pdfs')) {
          try {
            await this.storage.saveFile(pdfUrl, 'pdfs');
            this.results.filesDownloaded++;
            console.log(`  ✓ Downloaded PDF: ${path.basename(new URL(pdfUrl).pathname)}`);
            await this.delay(this.config.rateLimitMs);
          } catch (error) {
            console.error(`Error downloading PDF ${pdfUrl}:`, error);
          }
        } else {
          console.log(`  ⊘ Skipped PDF (already exists): ${path.basename(new URL(pdfUrl).pathname)}`);
        }
      }

      for (const excelUrl of extracted.excel) {
        if (!this.storage.hasBeenCrawled(excelUrl, 'excel')) {
          try {
            await this.storage.saveFile(excelUrl, 'excel');
            this.results.filesDownloaded++;
            console.log(`  ✓ Downloaded Excel: ${path.basename(new URL(excelUrl).pathname)}`);
            await this.delay(this.config.rateLimitMs);
          } catch (error) {
            console.error(`Error downloading Excel ${excelUrl}:`, error);
          }
        } else {
          console.log(`  ⊘ Skipped Excel (already exists)`);
        }
      }

      // Add new internal links to queue (if not at max depth)
      // Only queue pages that haven't been crawled yet (skip already-saved pages)
      if (depth < this.config.maxDepth) {
        for (const link of extracted.links) {
          const normalizedLink = this.normalizeUrl(link);
          // Skip if already visited in this session OR already saved to disk
          const alreadyExists = this.visitedUrls.has(normalizedLink) || 
                                this.storage.hasBeenCrawled(normalizedLink, 'pages');
          if (!alreadyExists && this.results.pagesCrawled < this.config.maxPages) {
            this.visitedUrls.add(normalizedLink);
            this.queue.push({ url: normalizedLink, depth: depth + 1, isExternal: false });
            this.results.linksFound++;
          }
        }

        // Add external links to queue (limit depth to 2 for external sites to avoid crawling the whole internet)
        // We queue external pages even if already saved, so we can check for new links/PDFs
        if (depth < 2) {
          for (const link of extracted.externalLinks) {
            const normalizedLink = this.normalizeUrl(link);
            // Only skip if already visited in THIS session (to avoid infinite loops)
            // We still want to process external pages that were saved in previous runs
            if (!this.visitedUrls.has(normalizedLink) && this.results.pagesCrawled < this.config.maxPages) {
              this.visitedUrls.add(normalizedLink);
              this.queue.push({ url: normalizedLink, depth: depth + 1, isExternal: true });
              this.results.linksFound++;
              console.log(`  + Queued external link: ${normalizedLink}`);
            }
          }
        }
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Save crawl index
   */
  private async saveCrawlIndex(): Promise<void> {
    // Load existing index
    const existingIndex = await this.storage.loadIndex();
    
    const index: CrawlIndex = {
      lastCrawl: new Date(),
      pages: existingIndex?.pages || [],
      pdfs: existingIndex?.pdfs || [],
      excel: existingIndex?.excel || [],
      images: existingIndex?.images || [],
      otherFiles: existingIndex?.otherFiles || [],
    };

    await this.storage.saveIndex(index);
  }
}


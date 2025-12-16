import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

export interface ExtractedContent {
  text: string;
  links: string[]; // Internal links (same domain)
  externalLinks: string[]; // External links (different domain)
  images: Array<{ url: string; alt?: string }>;
  pdfs: string[];
  excel: string[];
  otherFiles: Array<{ url: string; type: string }>;
}

/**
 * Extract various content types from HTML
 */
export class ContentExtractor {
  private baseUrl: string;
  private domain: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.domain = new URL(baseUrl).hostname;
  }

  /**
   * Extract all content from HTML
   */
  extract(html: string, pageUrl: string): ExtractedContent {
    const $ = cheerio.load(html) as cheerio.CheerioAPI;
    
    // Remove scripts, styles, and other non-content elements
    $('script, style, noscript, iframe, embed, object').remove();
    
    // Extract main text content
    const text = this.extractText($);
    
    // Extract links
    const links = this.extractLinks($, pageUrl);
    
    // Extract images
    const images = this.extractImages($, pageUrl);
    
    // Extract file links (PDFs, Excel, etc.)
    const { pdfs, excel, otherFiles } = this.extractFiles($, pageUrl);

    // Separate internal and external links
    const { internalLinks, externalLinks } = this.separateLinks(links, pageUrl);

    return {
      text,
      links: internalLinks,
      externalLinks,
      images,
      pdfs,
      excel,
      otherFiles,
    };
  }

  /**
   * Extract text content from HTML with structure preservation
   * Handles messy pages by identifying sections and preserving hierarchy
   */
  private extractText($: cheerio.CheerioAPI): string {
    // Remove navigation, headers, footers, and other non-content
    $('nav, header, footer, .menu, .navigation, .sidebar, .widget').remove();
    
    // Get text from main content areas
    const selectors = [
      'main', 'article', '.content', '#content', '.main-content',
      'body' // Fallback to body
    ];

    let $content: cheerio.Cheerio | null = null;
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        $content = element;
        break;
      }
    }

    if (!$content || $content.length === 0) {
      $content = $('body');
    }

    // Extract structured text with headings and sections
    const sections: string[] = [];
    
    // Extract headings (h1-h6) as section markers
    $content.find('h1, h2, h3, h4, h5, h6').each((_, el) => {
      const heading = $(el).text().trim();
      if (heading) {
        sections.push(`\n## ${heading}\n`);
      }
    });

    // Extract paragraphs, lists, and other content blocks
    $content.find('p, li, .text, .description, .info').each((_, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) { // Only meaningful text
        sections.push(text);
      }
    });

    // If no structured content found, fall back to all text
    if (sections.length === 0) {
      const allText = $content.text();
      return this.cleanText(allText);
    }

    // Combine sections with proper spacing
    let text = sections.join('\n\n');
    
    // Clean up the final text
    return this.cleanText(text);
  }

  /**
   * Clean and normalize text
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
      .replace(/##\s+/g, '\n## ') // Ensure heading format
      .trim();
  }

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

  /**
   * Separate links into internal and external
   * Filters out non-content external links (CDNs, fonts, etc.)
   */
  private separateLinks(allLinks: string[], pageUrl: string): { internalLinks: string[]; externalLinks: string[] } {
    const internalLinks: string[] = [];
    const externalLinks: string[] = [];
    const seen = new Set<string>();

    // External domains to skip (CDNs, fonts, etc. - not useful content)
    const skipDomains = [
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'cdn.jsdelivr.net',
      'cdnjs.cloudflare.com',
      'ajax.googleapis.com',
      'code.jquery.com',
      'www.google-analytics.com',
      'www.googletagmanager.com',
      'www.google.com',
      'www.gstatic.com',
    ];

    for (const link of allLinks) {
      // Normalize URL (remove fragments)
      const normalized = this.normalizeUrl(link);
      if (seen.has(normalized)) continue;
      seen.add(normalized);

      try {
        const url = new URL(normalized);
        if (url.hostname === this.domain) {
          internalLinks.push(normalized);
        } else {
          // External link - only add if it's HTTP/HTTPS and not a skipped domain
          if ((url.protocol === 'http:' || url.protocol === 'https:') && 
              !skipDomains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain))) {
            externalLinks.push(normalized);
          }
        }
      } catch {
        // Invalid URL, skip
      }
    }

    return { internalLinks, externalLinks };
  }

  /**
   * Extract links from page
   * Enhanced to find links in more places:
   * - All <a href> links (including hidden ones)
   * - Clickable images (images wrapped in <a> tags)
   * - Links in dropdown menus
   * - Links in data attributes
   * - Links in iframes (for embedded content)
   * - Links extracted from text content
   */
  private extractLinks($: cheerio.CheerioAPI, pageUrl: string): string[] {
    const links: string[] = [];
    const seen = new Set<string>();

    // Helper to add link if valid (normalizes URL first)
    const addLink = (href: string) => {
      if (!href) return;

      // Normalize URL (remove fragments like #:~:text=...)
      const normalized = this.normalizeUrl(href);
      if (seen.has(normalized)) return;
      seen.add(normalized);

      // Skip javascript:, mailto:, tel:, and anchor-only links
      // Note: We skip mailto: and tel: as they're not web pages
      if (normalized.startsWith('javascript:') || 
          normalized.startsWith('mailto:') || 
          normalized.startsWith('tel:') ||
          normalized.startsWith('#')) {
        return;
      }

      try {
        const absoluteUrl = new URL(normalized, pageUrl).toString();
        const normalizedAbsolute = this.normalizeUrl(absoluteUrl);
        links.push(normalizedAbsolute);
      } catch (error) {
        // Invalid URL, skip
      }
    };

    // 1. Extract ALL <a href> links (including hidden ones)
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) addLink(href);
    });

    // 2. Extract clickable images (images inside <a> tags)
    $('a img').each((_, element) => {
      const $parent = $(element).parent('a');
      const href = $parent.attr('href');
      if (href) addLink(href);
    });

    // 3. Check for links in common dropdown menu structures
    // Also check for collapsed/expanded dropdowns (common in WordPress)
    $('ul.dropdown-menu a[href], ul.menu a[href], nav ul a[href], .dropdown a[href], .sub-menu a[href], .menu-item a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) addLink(href);
    });

    // 4. Check for links in all navigation structures (including WordPress menus)
    $('nav a[href], .navigation a[href], .menu a[href], .main-menu a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) addLink(href);
    });

    // 5. Check data attributes that might contain links
    $('[data-href], [data-link], [data-url], [onclick*="location"], [onclick*="window.open"]').each((_, element) => {
      const href = $(element).attr('data-href') || 
                   $(element).attr('data-link') || 
                   $(element).attr('data-url');
      if (href) addLink(href);
      
      // Also try to extract from onclick handlers
      const onclick = $(element).attr('onclick');
      if (onclick) {
        const urlMatch = onclick.match(/(?:location|window\.open)\s*[=(]\s*["']([^"']+)["']/);
        if (urlMatch) addLink(urlMatch[1]);
      }
    });

    // 6. Extract URLs from text content (look for patterns)
    const pageText = $.html() || '';
    // Look for URLs in href attributes even if not in <a> tags
    const hrefPattern = /href=["']([^"']+)["']/gi;
    let match;
    while ((match = hrefPattern.exec(pageText)) !== null) {
      addLink(match[1]);
    }

    // 7. Also check for relative paths that might be links
    // Look for patterns like /page-name or /category/page-name
    const relativePathPattern = /(?:href|src)=["'](\/[^"']+)["']/gi;
    while ((match = relativePathPattern.exec(pageText)) !== null) {
      const path = match[1];
      // Skip if it's a file extension (handled by extractFiles)
      if (!path.match(/\.(pdf|docx?|xlsx?|pptx?|jpg|jpeg|png|gif|svg|css|js)$/i)) {
        addLink(path);
      }
    }

    return links;
  }

  /**
   * Extract images from page
   */
  private extractImages($: cheerio.CheerioAPI, pageUrl: string): Array<{ url: string; alt?: string }> {
    const images: Array<{ url: string; alt?: string }> = [];
    const seen = new Set<string>();

    $('img[src]').each((_, element) => {
      const src = $(element).attr('src');
      const alt = $(element).attr('alt');
      
      if (!src) return;

      try {
        const absoluteUrl = new URL(src, pageUrl).toString();
        
        if (!seen.has(absoluteUrl)) {
          images.push({ url: absoluteUrl, alt });
          seen.add(absoluteUrl);
        }
      } catch (error) {
        // Invalid URL, skip
      }
    });

    return images;
  }

  /**
   * Extract file links (PDFs, Excel, etc.)
   * Enhanced to find PDFs in multiple places:
   * - <a href> links
   * - <iframe src> (embedded PDFs)
   * - <embed src>
   * - <object data>
   * - Direct URLs in text content
   * - Data attributes
   */
  private extractFiles($: cheerio.CheerioAPI, pageUrl: string): {
    pdfs: string[];
    excel: string[];
    otherFiles: Array<{ url: string; type: string }>;
  } {
    const pdfs: string[] = [];
    const excel: string[] = [];
    const otherFiles: Array<{ url: string; type: string }> = [];
    const seen = new Set<string>();

    // Helper to add file URL if valid
    const addFile = (urlString: string) => {
      if (!urlString || seen.has(urlString)) return;
      
      try {
        const absoluteUrl = new URL(urlString, pageUrl).toString();
        const url = new URL(absoluteUrl);
        const pathname = url.pathname.toLowerCase();

        // Only process files from the same domain
        if (url.hostname !== this.domain) return;

        seen.add(absoluteUrl);

        if (pathname.endsWith('.pdf')) {
          pdfs.push(absoluteUrl);
        } else if (pathname.endsWith('.xlsx') || pathname.endsWith('.xls')) {
          excel.push(absoluteUrl);
        } else if (pathname.match(/\.(doc|docx|ppt|pptx|txt|csv)$/)) {
          const ext = pathname.split('.').pop() || 'unknown';
          otherFiles.push({ url: absoluteUrl, type: ext });
        }
      } catch (error) {
        // Invalid URL, skip
      }
    };

    // 1. Check all <a href> links
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) addFile(href);
    });

    // 2. Check <iframe src> (embedded PDFs)
    $('iframe[src]').each((_, element) => {
      const src = $(element).attr('src');
      if (src) addFile(src);
    });

    // 3. Check <embed src>
    $('embed[src]').each((_, element) => {
      const src = $(element).attr('src');
      if (src) addFile(src);
    });

    // 4. Check <object data>
    $('object[data]').each((_, element) => {
      const data = $(element).attr('data');
      if (data) addFile(data);
    });

    // 5. Check data attributes that might contain file URLs
    $('[data-pdf], [data-file], [data-url], [data-src]').each((_, element) => {
      const pdfUrl = $(element).attr('data-pdf');
      const fileUrl = $(element).attr('data-file');
      const url = $(element).attr('data-url');
      const src = $(element).attr('data-src');
      
      if (pdfUrl) addFile(pdfUrl);
      if (fileUrl) addFile(fileUrl);
      if (url) addFile(url);
      if (src) addFile(src);
    });

    // 6. Extract PDF URLs from text content (look for patterns like /uploads/.../file.pdf)
    const pageText = $.text();
    const pdfUrlPattern = /(https?:\/\/[^\s]+\.pdf|wp-content\/uploads\/[^\s"']+\.pdf)/gi;
    const matches = pageText.match(pdfUrlPattern);
    if (matches) {
      matches.forEach(match => {
        // Clean up the match (remove trailing punctuation)
        const cleanMatch = match.replace(/[.,;:!?)\]}>'"`]+$/, '');
        addFile(cleanMatch);
      });
    }

    // 7. Also check for PDFs in href attributes that might be in JavaScript or other attributes
    $('[href*=".pdf"], [src*=".pdf"], [data-href*=".pdf"]').each((_, element) => {
      const href = $(element).attr('href') || $(element).attr('src') || $(element).attr('data-href');
      if (href && href.includes('.pdf')) {
        addFile(href);
      }
    });

    return { pdfs, excel, otherFiles };
  }
}


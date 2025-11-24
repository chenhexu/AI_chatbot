/**
 * Simple robots.txt parser
 * Respects crawling rules from robots.txt
 */
export interface RobotsRules {
  allowed: boolean;
  crawlDelay?: number; // in seconds
}

export class RobotsParser {
  private rules: Map<string, RobotsRules> = new Map();
  private defaultDelay: number = 3; // Default 3 seconds

  /**
   * Parse robots.txt content
   */
  parse(robotsContent: string, userAgent: string = '*'): void {
    const lines = robotsContent.split('\n');
    let currentUserAgent = '*';
    let currentRules: RobotsRules = { allowed: true };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const [key, ...valueParts] = trimmed.split(':').map(s => s.trim());
      const value = valueParts.join(':').trim().toLowerCase();

      if (key.toLowerCase() === 'user-agent') {
        // Save previous rules
        if (currentUserAgent) {
          this.rules.set(currentUserAgent, currentRules);
        }
        // Start new user agent
        currentUserAgent = value;
        currentRules = { allowed: true };
      } else if (key.toLowerCase() === 'disallow') {
        if (value === '/') {
          currentRules.allowed = false;
        } else if (value && !currentRules.allowed) {
          // Already disallowed
        }
      } else if (key.toLowerCase() === 'allow') {
        currentRules.allowed = true;
      } else if (key.toLowerCase() === 'crawl-delay') {
        const delay = parseFloat(value);
        if (!isNaN(delay)) {
          currentRules.crawlDelay = delay;
        }
      }
    }

    // Save last rules
    if (currentUserAgent) {
      this.rules.set(currentUserAgent, currentRules);
    }
  }

  /**
   * Check if a URL is allowed to be crawled
   */
  isAllowed(url: string, userAgent: string = '*'): boolean {
    // Check specific user agent first, then wildcard
    const specificRules = this.rules.get(userAgent);
    const wildcardRules = this.rules.get('*');

    const rules = specificRules || wildcardRules;
    return rules ? rules.allowed : true; // Default to allowed if no rules
  }

  /**
   * Get crawl delay for a user agent
   */
  getCrawlDelay(userAgent: string = '*'): number {
    const specificRules = this.rules.get(userAgent);
    const wildcardRules = this.rules.get('*');

    const rules = specificRules || wildcardRules;
    return rules?.crawlDelay || this.defaultDelay;
  }

  /**
   * Fetch and parse robots.txt from a domain
   */
  static async fetchRobotsTxt(baseUrl: string): Promise<RobotsParser> {
    try {
      const url = new URL('/robots.txt', baseUrl);
      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'Collège-Saint-Louis-Crawler/1.0',
        },
      });

      if (!response.ok) {
        // If robots.txt doesn't exist, return default (allow all)
        return new RobotsParser();
      }

      const content = await response.text();
      const parser = new RobotsParser();
      parser.parse(content);
      return parser;
    } catch (error) {
      console.warn('Could not fetch robots.txt, assuming allowed:', error);
      return new RobotsParser(); // Default: allow all
    }
  }
}





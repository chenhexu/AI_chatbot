import * as dotenv from 'dotenv';
import { WebCrawler } from '../lib/crawler/crawler';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function main() {
  const startUrl = process.env.CRAWLER_START_URL || 'https://collegesaintlouis.ecolelachine.com/';
  
  const crawler = new WebCrawler({
    startUrl,
    maxDepth: parseInt(process.env.CRAWLER_MAX_DEPTH || '4'),
    maxPages: parseInt(process.env.CRAWLER_MAX_PAGES || '2000'),
    rateLimitMs: parseInt(process.env.CRAWLER_RATE_LIMIT_MS || '3000'), // 3 seconds per request (safe for burstable instances)
    userAgent: 'Collège-Saint-Louis-Crawler/1.0',
    dataFolder: process.env.CRAWLER_DATA_FOLDER || './data/scraped',
  });

  // Set skip crawled pages if env var is set
  if (process.env.SKIP_CRAWLED_PAGES === 'true') {
    console.log('⚠️  Skipping already-crawled pages (temporary mode)');
  }

  try {
    const results = await crawler.crawl();
    console.log('\n✅ Crawl completed successfully!');
    console.log(`📁 Data saved to: ${process.env.CRAWLER_DATA_FOLDER || './data/scraped'}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Crawl failed:', error);
    process.exit(1);
  }
}

main();


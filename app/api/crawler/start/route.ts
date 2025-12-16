import { NextResponse } from 'next/server';
import { setCrawlerState, getCrawlerState } from '@/lib/crawlerState';

let crawlerProcess: { kill: () => void } | null = null;

export async function POST(request: Request) {
  try {
    // Check if already running
    const state = getCrawlerState();
    if (state.isRunning) {
      return NextResponse.json({ success: false, error: 'Crawler is already running' });
    }

    const config = await request.json();
    const { maxPages, maxDepth, rateLimitMs, skipCrawled } = config;

    // Set environment variable for skip crawled
    if (skipCrawled) {
      process.env.SKIP_CRAWLED_PAGES = 'true';
    } else {
      delete process.env.SKIP_CRAWLED_PAGES;
    }

    // Start crawler in background
    // Note: In production, use a proper job queue (Bull, BullMQ) or background worker
    const { spawn } = require('child_process');
    const crawler = spawn('npm', ['run', 'crawl'], {
      env: {
        ...process.env,
        CRAWLER_MAX_PAGES: maxPages.toString(),
        CRAWLER_MAX_DEPTH: maxDepth.toString(),
        CRAWLER_RATE_LIMIT_MS: rateLimitMs.toString(),
        SKIP_CRAWLED_PAGES: skipCrawled ? 'true' : 'false',
      },
      detached: true,
      stdio: 'ignore',
    });

    crawler.unref(); // Allow Node to exit independently
    crawlerProcess = { kill: () => crawler.kill() };

    setCrawlerState({
      isRunning: true,
      pagesCrawled: 0,
      filesDownloaded: 0,
      linksFound: 0,
      errors: 0,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error starting crawler:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


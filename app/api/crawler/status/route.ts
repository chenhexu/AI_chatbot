import { NextResponse } from 'next/server';

// In-memory crawler state (in production, use Redis or database)
let crawlerState: {
  isRunning: boolean;
  pagesCrawled: number;
  filesDownloaded: number;
  linksFound: number;
  errors: number;
  currentUrl?: string;
  queueLength?: number;
} = {
  isRunning: false,
  pagesCrawled: 0,
  filesDownloaded: 0,
  linksFound: 0,
  errors: 0,
};

export function setCrawlerState(state: typeof crawlerState) {
  crawlerState = { ...crawlerState, ...state };
}

export function getCrawlerState() {
  return crawlerState;
}

export async function GET() {
  return NextResponse.json(crawlerState);
}


import { NextResponse } from 'next/server';
import { getCrawlerState } from '@/lib/crawlerState';

export async function GET() {
  return NextResponse.json(getCrawlerState());
}


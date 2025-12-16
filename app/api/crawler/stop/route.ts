import { NextResponse } from 'next/server';
import { setCrawlerState, getCrawlerProcess, setCrawlerProcess } from '@/lib/crawlerState';

export async function POST() {
  try {
    const crawlerProcess = getCrawlerProcess();
    if (crawlerProcess) {
      crawlerProcess.kill();
      setCrawlerProcess(null);
    }

    setCrawlerState({ isRunning: false });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error stopping crawler:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


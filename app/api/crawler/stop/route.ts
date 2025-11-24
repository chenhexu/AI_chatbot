import { NextResponse } from 'next/server';
import { setCrawlerState } from '../status/route';

let crawlerProcess: { kill: () => void } | null = null;

export function setCrawlerProcess(process: { kill: () => void } | null) {
  crawlerProcess = process;
}

export async function POST() {
  try {
    if (crawlerProcess) {
      crawlerProcess.kill();
      crawlerProcess = null;
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


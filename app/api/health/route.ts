import { NextResponse } from 'next/server';

/**
 * Health check endpoint for Render
 * Render will ping this endpoint to verify the service is running
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
}




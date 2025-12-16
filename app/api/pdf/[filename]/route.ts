import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

/**
 * API endpoint to serve PDF files
 * GET /api/pdf/[filename]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    // Next.js 15+ requires params to be a Promise
    const resolvedParams = await params;
    const filename = resolvedParams.filename;
    
    // Security: Only allow PDF files and prevent directory traversal
    if (!filename.endsWith('.pdf') || filename.includes('..') || filename.includes('/')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }
    
    // Resolve PDF file path
    const baseDir = process.env.CRAWLER_DATA_FOLDER || './data/scraped';
    const pdfPath = path.resolve(process.cwd(), baseDir, 'pdfs', filename);
    
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json(
        { error: 'PDF file not found' },
        { status: 404 }
      );
    }
    
    // Read PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    // Return PDF with proper headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error serving PDF:', error);
    return NextResponse.json(
      { error: 'Failed to serve PDF file' },
      { status: 500 }
    );
  }
}


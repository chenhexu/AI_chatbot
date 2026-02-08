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
    
    // Decode URL-encoded filename
    const decodedFilename = decodeURIComponent(filename);
    
    // Security: Only allow PDF files and prevent directory traversal
    if (!decodedFilename.endsWith('.pdf') || decodedFilename.includes('..') || decodedFilename.includes('/') || decodedFilename.includes('\\')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }
    
    // Resolve PDF file path (use decoded filename)
    const baseDir = process.env.CRAWLER_DATA_FOLDER || './data/scraped';
    const pdfPath = path.resolve(process.cwd(), baseDir, 'pdfs', decodedFilename);
    
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      console.error(`PDF not found: ${pdfPath} (requested filename: ${decodedFilename})`);
      return NextResponse.json(
        { error: 'PDF file not found', filename: decodedFilename, path: pdfPath },
        { status: 404 }
      );
    }
    
    // Read PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    // Return PDF with proper headers (use decoded filename for Content-Disposition)
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${decodedFilename}"; filename*=UTF-8''${encodeURIComponent(decodedFilename)}`,
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


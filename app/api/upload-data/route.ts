import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

/**
 * API endpoint to upload data files to Render server
 * POST /api/upload-data
 * 
 * Accepts:
 * - FormData with files
 * - Files should be organized in folders: pdf-texts/, pages/, external/
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const baseDir = process.env.CRAWLER_DATA_FOLDER || './data/scraped';
    const scrapedDir = path.resolve(process.cwd(), baseDir);

    // Ensure base directories exist
    const dirs = {
      pdfTexts: path.join(scrapedDir, 'pdf-texts'),
      pages: path.join(scrapedDir, 'pages'),
      external: path.join(scrapedDir, 'external'),
    };

    for (const dir of Object.values(dirs)) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    let uploadedCount = 0;
    let errors: string[] = [];

    // Process all files from formData
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        try {
          // Determine target directory based on key or file path
          let targetDir: string;
          if (key.includes('pdf-texts') || key.startsWith('pdf-texts/')) {
            targetDir = dirs.pdfTexts;
          } else if (key.includes('pages') || key.startsWith('pages/')) {
            targetDir = dirs.pages;
          } else if (key.includes('external') || key.startsWith('external/')) {
            targetDir = dirs.external;
          } else {
            // Try to infer from filename or default to pages
            const fileName = value.name.toLowerCase();
            if (fileName.includes('pdf') || fileName.endsWith('.txt')) {
              // Check if it's a PDF text file (usually has pdf name pattern)
              if (fileName.includes('pdf') || fileName.match(/_[a-f0-9]+\.txt$/)) {
                targetDir = dirs.pdfTexts;
              } else {
                targetDir = dirs.pages;
              }
            } else {
              targetDir = dirs.pages;
            }
          }

          // Get file content
          const arrayBuffer = await value.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Extract filename from key (remove folder prefix if present)
          let fileName = value.name || key;
          if (key.includes('/')) {
            fileName = key.split('/').pop() || value.name;
          }

          // Sanitize filename
          fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

          // Write file
          const filePath = path.join(targetDir, fileName);
          fs.writeFileSync(filePath, buffer);

          uploadedCount++;
          console.log(`✅ Uploaded: ${fileName} -> ${path.relative(scrapedDir, filePath)}`);
        } catch (error) {
          const errorMsg = `Failed to upload ${value.name}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }
    }

    if (uploadedCount === 0 && errors.length === 0) {
      return NextResponse.json(
        { error: 'No files received', uploaded: 0 },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      uploaded: uploadedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully uploaded ${uploadedCount} file(s)${errors.length > 0 ? ` (${errors.length} errors)` : ''}`
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        error: 'Upload failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload-data - Check current data status
 */
export async function GET() {
  try {
    const baseDir = process.env.CRAWLER_DATA_FOLDER || './data/scraped';
    const scrapedDir = path.resolve(process.cwd(), baseDir);

    const dirs = {
      pdfTexts: path.join(scrapedDir, 'pdf-texts'),
      pages: path.join(scrapedDir, 'pages'),
      external: path.join(scrapedDir, 'external'),
    };

    const counts: { [key: string]: number } = {};

    for (const [name, dir] of Object.entries(dirs)) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => 
          fs.statSync(path.join(dir, f)).isFile()
        );
        counts[name] = files.length;
      } else {
        counts[name] = 0;
      }
    }

    return NextResponse.json({
      status: 'ok',
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to check data status',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}


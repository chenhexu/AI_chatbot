import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, closeDatabase } from '@/lib/database/client';
import { loadAllDocuments } from '@/lib/documentLoader';
import { processDocuments } from '@/lib/rag';
import { storeDocument, storeChunks, clearAllData, getDocumentCount, getChunkCount } from '@/lib/database/documentStore';

// PostgreSQL tsvector limit is 1MB (1048575 bytes)
// Use 400KB to be very safe (allows for encoding overhead and gives room)
const MAX_CHUNK_BYTES = 400 * 1024; // 400KB in bytes
const MAX_DOCUMENT_BYTES = 400 * 1024; // 400KB for document content

/**
 * Format size with both bytes/KB/MB and character count
 */
function formatSize(text: string): string {
  const bytes = Buffer.byteLength(text, 'utf8');
  const chars = text.length;
  if (bytes < 1024) return `${bytes}B / ${chars} chars`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB / ${chars.toLocaleString()} chars`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB / ${chars.toLocaleString()} chars`;
}

/**
 * Split text into smaller pieces based on BYTE size (not character count)
 * This is important because PostgreSQL tsvector limit is in bytes
 */
function splitLargeText(text: string, maxBytes: number): string[] {
  const textBytes = Buffer.byteLength(text, 'utf8');
  if (textBytes <= maxBytes) {
    return [text];
  }
  
  const pieces: string[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    const remainingBytes = Buffer.byteLength(remaining, 'utf8');
    if (remainingBytes <= maxBytes) {
      pieces.push(remaining);
      break;
    }
    
    // Estimate character count for target byte size
    // Assume average 2 bytes per char for safety (covers UTF-8 overhead)
    let estimatedChars = Math.floor(maxBytes / 2);
    
    // Find a good split point near our estimate
    let splitPoint = -1;
    
    // Try paragraph boundary first
    const paragraphEnd = remaining.lastIndexOf('\n\n', estimatedChars);
    if (paragraphEnd > estimatedChars / 4) {
      splitPoint = paragraphEnd + 2; // Include the newlines
    }
    
    // Try single newline
    if (splitPoint < 0) {
      const lineEnd = remaining.lastIndexOf('\n', estimatedChars);
      if (lineEnd > estimatedChars / 4) {
        splitPoint = lineEnd + 1;
      }
    }
    
    // Try sentence boundary
    if (splitPoint < 0) {
      const sentenceEnd = remaining.lastIndexOf('. ', estimatedChars);
      if (sentenceEnd > estimatedChars / 4) {
        splitPoint = sentenceEnd + 2;
      }
    }
    
    // Force split if no good boundary found
    if (splitPoint < 0) {
      splitPoint = estimatedChars;
    }
    
    // Make sure split point doesn't exceed remaining text
    splitPoint = Math.min(splitPoint, remaining.length);
    
    const piece = remaining.substring(0, splitPoint);
    const pieceBytes = Buffer.byteLength(piece, 'utf8');
    
    // If piece is still too big, reduce split point
    if (pieceBytes > maxBytes) {
      // Binary search for correct split point
      let low = 0;
      let high = splitPoint;
      while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        if (Buffer.byteLength(remaining.substring(0, mid), 'utf8') <= maxBytes) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }
      splitPoint = low;
    }
    
    if (splitPoint === 0) {
      // Edge case: even one character is too big (shouldn't happen)
      console.log(`   ⚠️  Cannot split further, skipping remaining ${formatSize(remaining)}`);
      break;
    }
    
    pieces.push(remaining.substring(0, splitPoint));
    remaining = remaining.substring(splitPoint).trim();
  }
  
  return pieces;
}

/**
 * API endpoint to migrate data from filesystem to database
 */
export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set', status: 'not_configured' },
        { status: 400 }
      );
    }

    const docCount = await getDocumentCount();
    const chunkCount = await getChunkCount();

    return NextResponse.json({
      status: 'ready',
      documents: docCount,
      chunks: chunkCount,
      message: docCount > 0 
        ? `Database has ${docCount} documents and ${chunkCount} chunks`
        : 'Database is empty. Run migration to populate it.'
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to check migration status',
        details: error instanceof Error ? error.message : String(error),
        status: 'error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const skippedFiles: { file: string; reason: string; size: number; chars: number }[] = [];
  const skippedChunks: { file: string; size: number; chars: number }[] = [];
  const splitFiles: { file: string; originalSize: string; newChunks: number }[] = [];
  
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set', status: 'not_configured' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const force = body.force === true;

    console.log('🚀 Starting migration to database...');
    console.log(`📊 Max chunk size: ${(MAX_CHUNK_BYTES / 1024).toFixed(0)}KB`);

    await initializeDatabase();

    const existingCount = await getDocumentCount();
    
    if (existingCount > 0 && !force) {
      return NextResponse.json({
        status: 'already_migrated',
        documents: existingCount,
        chunks: await getChunkCount(),
        message: 'Database already contains data. Use force=true to re-migrate.'
      });
    }

    if (existingCount > 0 && force) {
      console.log(`⚠️  Clearing existing ${existingCount} documents...`);
      await clearAllData();
    }

    console.log('📂 Loading documents from filesystem...');
    const documents = await loadAllDocuments();
    console.log(`✅ Loaded ${documents.length} documents from filesystem`);

    if (documents.length === 0) {
      return NextResponse.json({
        status: 'no_data',
        message: 'No documents found in filesystem. Make sure data/scraped/ folder has data.'
      });
    }

    console.log('🔪 Processing documents into chunks...');
    const chunks = processDocuments(documents);
    console.log(`✅ Created ${chunks.length} chunks`);

    console.log('💾 Storing in database...');
    let storedDocs = 0;
    let storedChunks = 0;

    // Group chunks by document source
    const chunksBySource = new Map<string, typeof chunks>();
    for (const chunk of chunks) {
      if (!chunksBySource.has(chunk.source)) {
        chunksBySource.set(chunk.source, []);
      }
      chunksBySource.get(chunk.source)!.push(chunk);
    }

    // Store each document
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const docName = doc.id.split('/').pop() || doc.id;
      
      console.log(`📄 [${i + 1}/${documents.length}] Processing: ${docName.substring(0, 60)}...`);
      
      const docContentBytes = Buffer.byteLength(doc.content, 'utf8');
      const docContentChars = doc.content.length;
      
      // Truncate document content if too large
      let documentContent = doc.content;
      if (docContentBytes > MAX_DOCUMENT_BYTES) {
        console.log(`   ⚠️  Document too large (${formatSize(doc.content)}), truncating...`);
        // Find a safe truncation point
        const pieces = splitLargeText(doc.content, MAX_DOCUMENT_BYTES - 200);
        documentContent = pieces[0] + '\n\n[Content truncated - see chunks for full text]';
      }
      
      try {
        const documentId = await storeDocument(
          doc.id,
          doc.id.startsWith('file://') ? 'file' : 'external',
          documentContent,
          docName,
          doc.pdfUrl
        );

        // Process chunks for this document
        const docChunks = chunksBySource.get(doc.id) || [];
        const processedChunks: { text: string; index: number; source: string; pdfUrl?: string }[] = [];
        let chunkIndex = 0;
        
        for (const chunk of docChunks) {
          const chunkBytes = Buffer.byteLength(chunk.text, 'utf8');
          
          if (chunkBytes > MAX_CHUNK_BYTES) {
            console.log(`   🔪 Splitting large chunk (${formatSize(chunk.text)})...`);
            const pieces = splitLargeText(chunk.text, MAX_CHUNK_BYTES);
            
            let validPieces = 0;
            for (const piece of pieces) {
              const pieceBytes = Buffer.byteLength(piece, 'utf8');
              if (pieceBytes > MAX_CHUNK_BYTES) {
                console.log(`   ⚠️  Piece still too large (${formatSize(piece)}), skipping...`);
                skippedChunks.push({
                  file: docName,
                  size: pieceBytes,
                  chars: piece.length,
                });
                continue;
              }
              processedChunks.push({
                text: piece,
                index: chunkIndex++,
                source: chunk.source,
                pdfUrl: chunk.pdfUrl,
              });
              validPieces++;
            }
            
            if (validPieces > 0) {
              splitFiles.push({
                file: docName,
                originalSize: formatSize(chunk.text),
                newChunks: validPieces,
              });
            }
          } else {
            processedChunks.push({
              text: chunk.text,
              index: chunkIndex++,
              source: chunk.source,
              pdfUrl: chunk.pdfUrl,
            });
          }
        }
        
        if (processedChunks.length > 0) {
          await storeChunks(documentId, processedChunks);
          storedChunks += processedChunks.length;
        }

        storedDocs++;
        
        if (storedDocs % 50 === 0) {
          console.log(`   📊 Progress: ${storedDocs}/${documents.length} documents, ${storedChunks} chunks`);
        }
        
      } catch (docError) {
        const errorMsg = docError instanceof Error ? docError.message : String(docError);
        console.error(`   ❌ Failed to store document: ${errorMsg}`);
        
        skippedFiles.push({
          file: docName,
          reason: errorMsg.substring(0, 100),
          size: docContentBytes,
          chars: docContentChars,
        });
        continue;
      }
    }

    await closeDatabase();

    console.log(`\n✅ Migration complete!`);
    console.log(`   📊 Documents: ${storedDocs}/${documents.length}`);
    console.log(`   📊 Chunks: ${storedChunks}`);
    if (skippedFiles.length > 0) {
      console.log(`   ❌ Skipped documents: ${skippedFiles.length}`);
      skippedFiles.forEach(f => console.log(`      - ${f.file}: ${f.reason}`));
    }
    if (skippedChunks.length > 0) {
      console.log(`   ⚠️  Skipped chunks: ${skippedChunks.length}`);
    }
    if (splitFiles.length > 0) {
      console.log(`   🔪 Split large chunks: ${splitFiles.length}`);
    }

    return NextResponse.json({
      status: 'success',
      documents: storedDocs,
      chunks: storedChunks,
      skippedDocuments: skippedFiles,
      skippedChunks: skippedChunks.length,
      splitChunks: splitFiles.length,
      message: `Migrated ${storedDocs} documents and ${storedChunks} chunks.` +
        (skippedFiles.length > 0 ? ` Skipped ${skippedFiles.length} documents.` : '') +
        (skippedChunks.length > 0 ? ` Skipped ${skippedChunks.length} chunks.` : '')
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await closeDatabase().catch(() => {});
    
    return NextResponse.json(
      { 
        error: 'Migration failed',
        details: error instanceof Error ? error.message : String(error),
        skippedDocuments: skippedFiles,
        skippedChunks: skippedChunks.length,
        status: 'error'
      },
      { status: 500 }
    );
  }
}

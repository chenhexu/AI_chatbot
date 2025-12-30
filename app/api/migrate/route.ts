import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, closeDatabase } from '@/lib/database/client';
import { loadAllDocuments } from '@/lib/documentLoader';
import { processDocuments } from '@/lib/rag';
import { storeDocument, storeChunks, clearAllData, getDocumentCount, getChunkCount } from '@/lib/database/documentStore';

// PostgreSQL tsvector limit is 1MB (1048575 bytes)
// We use 900KB as safe limit to account for encoding overhead
const MAX_CHUNK_SIZE = 900 * 1024; // 900KB
const MAX_DOCUMENT_SIZE = 900 * 1024; // 900KB for document content

/**
 * Split text into smaller pieces if needed
 */
function splitLargeText(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) {
    return [text];
  }
  
  const pieces: string[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxSize) {
      pieces.push(remaining);
      break;
    }
    
    // Try to split at a paragraph or sentence boundary
    let splitPoint = remaining.lastIndexOf('\n\n', maxSize);
    if (splitPoint < maxSize / 2) {
      splitPoint = remaining.lastIndexOf('\n', maxSize);
    }
    if (splitPoint < maxSize / 2) {
      splitPoint = remaining.lastIndexOf('. ', maxSize);
    }
    if (splitPoint < maxSize / 2) {
      splitPoint = maxSize; // Force split
    }
    
    pieces.push(remaining.substring(0, splitPoint));
    remaining = remaining.substring(splitPoint).trim();
  }
  
  return pieces;
}

/**
 * API endpoint to migrate data from filesystem to database
 * This can be called from the browser since Render free tier doesn't have shell access
 * 
 * GET /api/migrate - Check migration status
 * POST /api/migrate - Run migration
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
  const skippedFiles: { file: string; reason: string; size: number }[] = [];
  const splitFiles: { file: string; originalChunks: number; newChunks: number }[] = [];
  
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
    console.log(`📊 Max chunk size: ${(MAX_CHUNK_SIZE / 1024).toFixed(0)}KB`);

    // Initialize database schema
    console.log('📋 Initializing database schema...');
    await initializeDatabase();

    // Check if database already has data
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

    // Load documents from filesystem
    console.log('📂 Loading documents from filesystem...');
    const documents = await loadAllDocuments();
    console.log(`✅ Loaded ${documents.length} documents from filesystem`);

    if (documents.length === 0) {
      return NextResponse.json({
        status: 'no_data',
        message: 'No documents found in filesystem. Make sure data/scraped/ folder has data.'
      });
    }

    // Process documents into chunks
    console.log('🔪 Processing documents into chunks...');
    const chunks = processDocuments(documents);
    console.log(`✅ Created ${chunks.length} chunks`);

    // Store documents and chunks in database
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
      
      console.log(`📄 [${i + 1}/${documents.length}] Processing: ${docName.substring(0, 50)}...`);
      
      // Check document content size
      const docContentSize = Buffer.byteLength(doc.content, 'utf8');
      
      // Truncate document content if too large (for the documents table)
      let documentContent = doc.content;
      if (docContentSize > MAX_DOCUMENT_SIZE) {
        console.log(`   ⚠️  Document content too large (${(docContentSize / 1024 / 1024).toFixed(2)}MB), truncating for storage...`);
        // Truncate to fit, keeping a note at the end
        documentContent = doc.content.substring(0, MAX_DOCUMENT_SIZE - 100) + 
          '\n\n[Content truncated - full text available in chunks]';
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
          const chunkSize = Buffer.byteLength(chunk.text, 'utf8');
          
          if (chunkSize > MAX_CHUNK_SIZE) {
            // Split large chunk
            console.log(`   🔪 Splitting large chunk (${(chunkSize / 1024).toFixed(0)}KB)...`);
            const pieces = splitLargeText(chunk.text, MAX_CHUNK_SIZE);
            
            for (const piece of pieces) {
              const pieceSize = Buffer.byteLength(piece, 'utf8');
              if (pieceSize > MAX_CHUNK_SIZE) {
                console.log(`   ⚠️  Chunk piece still too large (${(pieceSize / 1024).toFixed(0)}KB), skipping...`);
                continue;
              }
              processedChunks.push({
                text: piece,
                index: chunkIndex++,
                source: chunk.source,
                pdfUrl: chunk.pdfUrl,
              });
            }
            
            splitFiles.push({
              file: docName,
              originalChunks: 1,
              newChunks: pieces.length,
            });
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
          console.log(`   📊 Progress: ${storedDocs}/${documents.length} documents, ${storedChunks} chunks stored`);
        }
        
      } catch (docError) {
        const errorMsg = docError instanceof Error ? docError.message : String(docError);
        console.error(`   ❌ Failed to store document: ${errorMsg}`);
        
        skippedFiles.push({
          file: docName,
          reason: errorMsg.substring(0, 100),
          size: docContentSize,
        });
        
        // Continue with next document instead of failing entirely
        continue;
      }
    }

    await closeDatabase();

    console.log(`\n✅ Migration complete!`);
    console.log(`   📊 Documents: ${storedDocs}/${documents.length}`);
    console.log(`   📊 Chunks: ${storedChunks}`);
    if (skippedFiles.length > 0) {
      console.log(`   ⚠️  Skipped files: ${skippedFiles.length}`);
      skippedFiles.forEach(f => console.log(`      - ${f.file} (${(f.size / 1024 / 1024).toFixed(2)}MB): ${f.reason}`));
    }
    if (splitFiles.length > 0) {
      console.log(`   🔪 Split files: ${splitFiles.length}`);
    }

    return NextResponse.json({
      status: 'success',
      documents: storedDocs,
      chunks: storedChunks,
      skipped: skippedFiles,
      split: splitFiles,
      message: skippedFiles.length > 0
        ? `Migrated ${storedDocs} documents and ${storedChunks} chunks. Skipped ${skippedFiles.length} files due to size.`
        : `Successfully migrated ${storedDocs} documents and ${storedChunks} chunks to database`
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await closeDatabase().catch(() => {});
    
    return NextResponse.json(
      { 
        error: 'Migration failed',
        details: error instanceof Error ? error.message : String(error),
        skipped: skippedFiles,
        status: 'error'
      },
      { status: 500 }
    );
  }
}

import { query } from './client';
import { TextChunk } from '../rag';

export interface DocumentRecord {
  id: number;
  source_id: string;
  source_type: string;
  name: string | null;
  content: string;
  pdf_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ChunkRecord {
  id: number;
  document_id: number;
  text: string;
  chunk_index: number;
  source: string;
  pdf_url: string | null;
  embedding: number[] | null;
  created_at: Date;
}

// Extended TextChunk with embedding
export interface TextChunkWithEmbedding extends TextChunk {
  id?: number;
  embedding?: number[];
}

/**
 * Store a document in the database
 */
export async function storeDocument(
  sourceId: string,
  sourceType: string,
  content: string,
  name?: string,
  pdfUrl?: string
): Promise<number> {
  // Insert or update document
  const result = await query<DocumentRecord>(
    `INSERT INTO documents (source_id, source_type, name, content, pdf_url, updated_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (source_id) 
     DO UPDATE SET 
       content = EXCLUDED.content,
       pdf_url = EXCLUDED.pdf_url,
       name = EXCLUDED.name,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [sourceId, sourceType, name || null, content, pdfUrl || null]
  );

  return result.rows[0].id;
}

/**
 * Store chunks for a document
 */
export async function storeChunks(
  documentId: number,
  chunks: Array<{ text: string; index: number; source: string; pdfUrl?: string; embedding?: number[] }>
): Promise<void> {
  // Delete existing chunks for this document
  await query('DELETE FROM chunks WHERE document_id = $1', [documentId]);

  // Insert new chunks
  if (chunks.length === 0) return;

  const values: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  for (const chunk of chunks) {
    values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`);
    params.push(
      documentId, 
      chunk.text, 
      chunk.index, 
      chunk.source, 
      chunk.pdfUrl || null,
      chunk.embedding ? JSON.stringify(chunk.embedding) : null
    );
    paramIndex += 6;
  }

  await query(
    `INSERT INTO chunks (document_id, text, chunk_index, source, pdf_url, embedding)
     VALUES ${values.join(', ')}`,
    params
  );
}

/**
 * Load all chunks from database (without embeddings for faster loading)
 */
export async function loadAllChunks(): Promise<TextChunk[]> {
  try {
    console.log('📡 Executing database query to load chunks...');
    const result = await query<{ text: string; source: string; chunk_index: number; pdf_url: string | null }>(
      `SELECT text, source, chunk_index, pdf_url
       FROM chunks
       ORDER BY document_id, chunk_index`
    );

    console.log(`📊 Query returned ${result.rows.length} rows`);
    const chunks = result.rows.map(row => ({
      text: row.text,
      source: row.source,
      index: row.chunk_index,
      pdfUrl: row.pdf_url || undefined,
    }));
    
    console.log(`✅ Successfully loaded ${chunks.length} chunks from database`);
    return chunks;
  } catch (error) {
    console.error('❌ Error in loadAllChunks:', error);
    throw error;
  }
}

/**
 * Load all chunks with embeddings for semantic search
 */
export async function loadAllChunksWithEmbeddings(): Promise<TextChunkWithEmbedding[]> {
  try {
    console.log('📡 Loading chunks with embeddings...');
    const result = await query<{ 
      id: number;
      text: string; 
      source: string; 
      chunk_index: number; 
      pdf_url: string | null;
      embedding: number[] | null;
    }>(
      `SELECT id, text, source, chunk_index, pdf_url, embedding
       FROM chunks
       ORDER BY document_id, chunk_index`
    );

    console.log(`📊 Query returned ${result.rows.length} rows`);
    const chunks = result.rows.map(row => ({
      id: row.id,
      text: row.text,
      source: row.source,
      index: row.chunk_index,
      pdfUrl: row.pdf_url || undefined,
      embedding: row.embedding || undefined,
    }));
    
    const withEmbeddings = chunks.filter(c => c.embedding).length;
    console.log(`✅ Loaded ${chunks.length} chunks (${withEmbeddings} with embeddings)`);
    return chunks;
  } catch (error) {
    console.error('❌ Error in loadAllChunksWithEmbeddings:', error);
    throw error;
  }
}

/**
 * Update embedding for a chunk
 */
export async function updateChunkEmbedding(chunkId: number, embedding: number[]): Promise<void> {
  await query(
    `UPDATE chunks SET embedding = $1 WHERE id = $2`,
    [JSON.stringify(embedding), chunkId]
  );
}

/**
 * Update embeddings for multiple chunks in batch
 */
export async function updateChunkEmbeddingsBatch(
  updates: Array<{ id: number; embedding: number[] }>
): Promise<void> {
  if (updates.length === 0) return;

  // Use a transaction for batch updates
  for (const update of updates) {
    await query(
      `UPDATE chunks SET embedding = $1 WHERE id = $2`,
      [JSON.stringify(update.embedding), update.id]
    );
  }
}

/**
 * Get chunks without embeddings (for migration)
 */
export async function getChunksWithoutEmbeddings(): Promise<Array<{ id: number; text: string }>> {
  const result = await query<{ id: number; text: string }>(
    `SELECT id, text FROM chunks WHERE embedding IS NULL ORDER BY id`
  );
  return result.rows;
}

/**
 * Get count of chunks with/without embeddings
 */
export async function getEmbeddingStats(): Promise<{ total: number; withEmbedding: number; withoutEmbedding: number }> {
  const totalResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');
  const withEmbeddingResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM chunks WHERE embedding IS NOT NULL');
  
  const total = parseInt(totalResult.rows[0].count, 10);
  const withEmbedding = parseInt(withEmbeddingResult.rows[0].count, 10);
  
  return {
    total,
    withEmbedding,
    withoutEmbedding: total - withEmbedding,
  };
}

/**
 * Get document count
 */
export async function getDocumentCount(): Promise<number> {
  const result = await query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get chunk count
 */
export async function getChunkCount(): Promise<number> {
  const result = await query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');
  return parseInt(result.rows[0].count, 10);
}

/**
 * Clear all documents and chunks (for migration/reset)
 */
export async function clearAllData(): Promise<void> {
  await query('DELETE FROM chunks');
  await query('DELETE FROM documents');
}

/**
 * Add embedding column if it doesn't exist (migration helper)
 */
export async function ensureEmbeddingColumn(): Promise<void> {
  try {
    // Check if column exists
    const result = await query<{ column_name: string }>(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'chunks' AND column_name = 'embedding'`
    );
    
    if (result.rows.length === 0) {
      console.log('📋 Adding embedding column to chunks table...');
      await query('ALTER TABLE chunks ADD COLUMN embedding JSONB');
      await query('CREATE INDEX IF NOT EXISTS idx_chunks_has_embedding ON chunks((embedding IS NOT NULL))');
      console.log('✅ Embedding column added');
    } else {
      console.log('✅ Embedding column already exists');
    }
  } catch (error) {
    console.error('❌ Error ensuring embedding column:', error);
    throw error;
  }
}

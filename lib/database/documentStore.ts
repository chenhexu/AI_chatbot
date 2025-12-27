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
  chunks: Array<{ text: string; index: number; source: string; pdfUrl?: string }>
): Promise<void> {
  // Delete existing chunks for this document
  await query('DELETE FROM chunks WHERE document_id = $1', [documentId]);

  // Insert new chunks
  if (chunks.length === 0) return;

  const values: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  for (const chunk of chunks) {
    values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`);
    params.push(documentId, chunk.text, chunk.index, chunk.source, chunk.pdfUrl || null);
    paramIndex += 5;
  }

  await query(
    `INSERT INTO chunks (document_id, text, chunk_index, source, pdf_url)
     VALUES ${values.join(', ')}`,
    params
  );
}

/**
 * Load all chunks from database (without embeddings)
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
 * Load all chunks with embeddings from database
 * Falls back to loading without embeddings if the column doesn't exist
 */
export async function loadAllChunksWithEmbeddings(): Promise<Array<TextChunk & { id: number; embedding?: number[] }>> {
  try {
    console.log('📡 Loading chunks with embeddings...');
    
    // Try to load with embeddings first
    try {
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
      
      const withEmbeddings = chunks.filter(c => c.embedding && c.embedding.length > 0).length;
      console.log(`✅ Loaded ${chunks.length} chunks (${withEmbeddings} with embeddings)`);
      return chunks;
    } catch (embeddingError: any) {
      // If embedding column doesn't exist, fall back to loading without it
      if (embeddingError?.message?.includes('embedding') || embeddingError?.code === '42703') {
        console.log('⚠️  Embedding column not found, loading without embeddings...');
        const result = await query<{ 
          id: number;
          text: string; 
          source: string; 
          chunk_index: number; 
          pdf_url: string | null;
        }>(
          `SELECT id, text, source, chunk_index, pdf_url
           FROM chunks
           ORDER BY document_id, chunk_index`
        );

        const chunks = result.rows.map(row => ({
          id: row.id,
          text: row.text,
          source: row.source,
          index: row.chunk_index,
          pdfUrl: row.pdf_url || undefined,
          embedding: undefined,
        }));
        
        console.log(`✅ Loaded ${chunks.length} chunks (without embeddings)`);
        return chunks;
      }
      throw embeddingError;
    }
  } catch (error) {
    console.error('❌ Error in loadAllChunksWithEmbeddings:', error);
    throw error;
  }
}

/**
 * Get chunks that don't have embeddings yet
 */
export async function getChunksWithoutEmbeddings(limit: number = 50): Promise<Array<{ id: number; text: string }>> {
  const result = await query<{ id: number; text: string }>(
    `SELECT id, text FROM chunks WHERE embedding IS NULL LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Update chunk embeddings in batch
 */
export async function updateChunkEmbeddingsBatch(
  updates: Array<{ id: number; embedding: number[] }>
): Promise<void> {
  if (updates.length === 0) return;
  
  // Update each chunk's embedding
  for (const update of updates) {
    await query(
      `UPDATE chunks SET embedding = $1 WHERE id = $2`,
      [JSON.stringify(update.embedding), update.id]
    );
  }
}

/**
 * Get embedding statistics
 */
export async function getEmbeddingStats(): Promise<{ total: number; withEmbedding: number; withoutEmbedding: number }> {
  const totalResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM chunks');
  const withResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM chunks WHERE embedding IS NOT NULL');
  
  const total = parseInt(totalResult.rows[0].count, 10);
  const withEmbedding = parseInt(withResult.rows[0].count, 10);
  
  return {
    total,
    withEmbedding,
    withoutEmbedding: total - withEmbedding,
  };
}

/**
 * Ensure embedding column exists
 */
export async function ensureEmbeddingColumn(): Promise<void> {
  try {
    await query(`
      ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedding JSONB
    `);
    console.log('✅ Embedding column ensured');
  } catch (error) {
    // Column might already exist, which is fine
    console.log('ℹ️  Embedding column check completed');
  }
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


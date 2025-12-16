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
 * Load all chunks from database
 */
export async function loadAllChunks(): Promise<TextChunk[]> {
  const result = await query<ChunkRecord>(
    `SELECT text, source, chunk_index as "chunkIndex", pdf_url as "pdfUrl"
     FROM chunks
     ORDER BY document_id, chunk_index`
  );

  return result.rows.map(row => ({
    text: row.text,
    source: row.source,
    index: row.chunkIndex,
    pdfUrl: row.pdfUrl || undefined,
  }));
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


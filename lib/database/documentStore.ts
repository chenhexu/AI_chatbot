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
  chunks: Array<{ text: string; index: number; source: string; pdfUrl?: string; subject?: string }>
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
    params.push(documentId, chunk.text, chunk.index, chunk.source, chunk.pdfUrl || null, chunk.subject || null);
    paramIndex += 6;
  }

  await query(
    `INSERT INTO chunks (document_id, text, chunk_index, source, pdf_url, subject)
     VALUES ${values.join(', ')}`,
    params
  );
}

/**
 * Load chunks from database, optionally filtered by subjects
 */
export async function loadAllChunks(subjects?: string[]): Promise<TextChunk[]> {
  try {
    console.log('📡 Executing database query to load chunks...');
    
    let sql = `SELECT text, source, chunk_index, pdf_url
       FROM chunks`;
    
    const params: any[] = [];
    if (subjects && subjects.length > 0) {
      // Filter by subjects
      const placeholders = subjects.map((_, i) => `$${i + 1}`).join(', ');
      sql += ` WHERE subject IN (${placeholders})`;
      params.push(...subjects);
      console.log(`🔍 Filtering by subjects: ${subjects.join(', ')}`);
    }
    
    sql += ` ORDER BY document_id, chunk_index`;
    
    const result = await query<{ text: string; source: string; chunk_index: number; pdf_url: string | null }>(
      sql,
      params
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
 * Get document count
 */
export async function getDocumentCount(): Promise<number> {
  const result = await query<{ count: string }>('SELECT COUNT(*) as count FROM documents');
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get all existing source IDs from database
 */
export async function getExistingSourceIds(): Promise<Set<string>> {
  const result = await query<{ source_id: string }>('SELECT source_id FROM documents');
  return new Set(result.rows.map(row => row.source_id));
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


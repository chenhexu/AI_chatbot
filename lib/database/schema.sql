-- Database schema for storing documents and chunks
-- Run this to initialize the database

-- Documents table: stores metadata about each document
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  source_id VARCHAR(500) NOT NULL UNIQUE, -- Original source identifier (file path, URL, etc.)
  source_type VARCHAR(50) NOT NULL, -- 'file', 'pdf', 'google-doc', 'external', etc.
  name VARCHAR(500),
  content TEXT NOT NULL, -- Full document content
  pdf_url VARCHAR(1000), -- Original PDF URL if applicable
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chunks table: stores text chunks for RAG
CREATE TABLE IF NOT EXISTS chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL, -- Index of chunk within document
  source VARCHAR(500) NOT NULL, -- Source identifier for compatibility
  pdf_url VARCHAR(1000), -- PDF URL if applicable
  embedding JSONB, -- Embedding vector for semantic search (array of floats)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(document_id, chunk_index)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_documents_source_type ON documents(source_type);
CREATE INDEX IF NOT EXISTS idx_documents_source_id ON documents(source_id);

-- Full-text search index (PostgreSQL)
CREATE INDEX IF NOT EXISTS idx_chunks_text_search ON chunks USING gin(to_tsvector('french', text));
CREATE INDEX IF NOT EXISTS idx_documents_content_search ON documents USING gin(to_tsvector('french', content));

-- Index for embedding column (for chunks that have embeddings)
CREATE INDEX IF NOT EXISTS idx_chunks_has_embedding ON chunks((embedding IS NOT NULL));

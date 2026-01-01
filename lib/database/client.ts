import { Pool, QueryResult, QueryResultRow } from 'pg';

let pool: Pool | null = null;

/**
 * Get PostgreSQL connection pool
 */
export function getDatabasePool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
    });
  }

  return pool;
}

/**
 * Execute a query
 */
export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const db = getDatabasePool();
  return db.query<T>(text, params);
}

/**
 * Ensure subject column exists in chunks table (migration)
 */
export async function ensureSubjectColumn(): Promise<void> {
  try {
    // Check if column exists
    const checkResult = await query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chunks' AND column_name = 'subject'
      ) as exists`
    );
    
    if (!checkResult.rows[0].exists) {
      console.log('📝 Adding subject column to chunks table...');
      await query('ALTER TABLE chunks ADD COLUMN subject VARCHAR(100)');
      await query('CREATE INDEX IF NOT EXISTS idx_chunks_subject ON chunks(subject)');
      console.log('✅ Subject column added');
    }
  } catch (error) {
    console.error('❌ Error ensuring subject column:', error);
    throw error;
  }
}

/**
 * Ensure failed_classifications table exists (migration)
 */
export async function ensureFailedClassificationsTable(): Promise<void> {
  try {
    // Check if table exists
    const checkResult = await query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'failed_classifications'
      ) as exists`
    );
    
    if (!checkResult.rows[0].exists) {
      console.log('📝 Creating failed_classifications table...');
      await query(`
        CREATE TABLE failed_classifications (
          id SERIAL PRIMARY KEY,
          chunk_id INTEGER NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
          error_message TEXT,
          failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          retry_count INTEGER DEFAULT 0,
          UNIQUE(chunk_id)
        )
      `);
      await query('CREATE INDEX IF NOT EXISTS idx_failed_classifications_chunk_id ON failed_classifications(chunk_id)');
      console.log('✅ Failed classifications table created');
    }
  } catch (error: any) {
    // Ignore if table already exists
    if (error?.code !== '42P07') {
      console.error('❌ Error ensuring failed_classifications table:', error);
      throw error;
    }
  }
}

/**
 * Initialize database schema
 */
export async function initializeDatabase(): Promise<void> {
  try {
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.join(process.cwd(), 'lib', 'database', 'schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Extract DO blocks first (they contain semicolons)
    const doBlocks: string[] = [];
    const doBlockRegex = /DO\s+\$\$(\w*)\s*BEGIN[\s\S]*?END\s+\$\$\1\s*;/gi;
    let match;
    
    while ((match = doBlockRegex.exec(schema)) !== null) {
      doBlocks.push(match[0]);
      // Replace DO block with placeholder
      schema = schema.replace(match[0], `-- DO_BLOCK_PLACEHOLDER_${doBlocks.length - 1}`);
    }
    
    // Now split remaining schema by semicolons
    const statements = schema.split(';').filter((s: string) => s.trim().length > 0);
    
    // Replace placeholders with actual DO blocks
    const allStatements: string[] = [];
    for (const statement of statements) {
      if (statement.includes('DO_BLOCK_PLACEHOLDER')) {
        // Find and add the corresponding DO block
        const placeholderMatch = statement.match(/DO_BLOCK_PLACEHOLDER_(\d+)/);
        if (placeholderMatch) {
          const blockIndex = parseInt(placeholderMatch[1], 10);
          if (doBlocks[blockIndex]) {
            allStatements.push(doBlocks[blockIndex]);
          }
        }
      } else {
        allStatements.push(statement);
      }
    }
    
    // Execute all statements
    for (const statement of allStatements) {
      const trimmed = statement.trim();
      if (trimmed && !trimmed.startsWith('--')) {
        try {
          await query(trimmed);
        } catch (error: any) {
          // Ignore "already exists" errors for tables/indexes
          if (error?.code !== '42P07' && error?.code !== '42710') {
            console.warn('⚠️ Schema statement warning:', error.message);
          }
        }
      }
    }
    
    // Ensure subject column exists (migration - double check)
    await ensureSubjectColumn();
    
    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

/**
 * Close database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}


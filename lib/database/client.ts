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
 * Initialize database schema
 */
export async function initializeDatabase(): Promise<void> {
  try {
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.join(process.cwd(), 'lib', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema (split by semicolons for multiple statements)
    const statements = schema.split(';').filter((s: string) => s.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        await query(statement);
      }
    }
    
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


import { Pool } from 'pg';
// Note: dotenv should be configured at the application entry point (server.ts or server.test.ts)
// not in individual service files

let pool: Pool | null = null;

/**
 * Get or create the PostgreSQL connection pool
 * Uses DB_URL from environment variables
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DB_URL;
    
    if (!connectionString) {
      throw new Error('DB_URL environment variable is not set');
    }
    
    pool = new Pool({
      connectionString,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Fail connection attempts after 2 seconds
    });
    
    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  
  return pool;
}

/**
 * Close the database connection pool
 * Useful for graceful shutdown
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Test the database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    await client.query('SELECT NOW()');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}
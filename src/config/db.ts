import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let connectionString = process.env.DATABASE_URL;

// Override database name if it points to non-existent 'herfunds' database
if (connectionString && (connectionString.toLowerCase().endsWith('/herfunds') || connectionString.toLowerCase().endsWith('/herfunds/'))) {
  connectionString = connectionString.replace(/\/herfunds\/?$/i, '/postgres');
}

const pool = connectionString
  ? new pg.Pool({ connectionString })
  : new pg.Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      port: Number(process.env.DB_PORT) || 5432,
    });

// Auto-initialize required tables on server startup if missing
pool.on('connect', async (client) => {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        knowledge_level VARCHAR(50) DEFAULT 'Beginner',
        streak_count INT DEFAULT 0,
        last_checkin_date DATE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
  } catch (err) {
    console.error('Table verification error:', err);
  }
});

export default pool;

   

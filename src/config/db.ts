import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let connectionString = process.env.DATABASE_URL;

// Clean connection string if needed
if (connectionString && (connectionString.toLowerCase().endsWith('/herfunds') || connectionString.toLowerCase().endsWith('/herfunds/'))) {
  connectionString = connectionString.replace(/\/herfunds\/?$/i, '/postgres');
}

const pool = connectionString
  ? new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  : new pg.Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      port: Number(process.env.DB_PORT) || 5432,
    });

// 🚀 Execute table creation directly on startup
export const initDB = async () => {
  try {
    console.log('Verifying and initializing database tables...');
    await pool.query(`
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
    console.log('✅ Users table successfully verified/created!');
  } catch (err) {
    console.error('❌ Database initialization error:', err);
  }
};

// Run initialization
initDB();

export default pool;
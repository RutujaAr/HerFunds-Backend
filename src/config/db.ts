import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

let connectionString = process.env.DATABASE_URL;

// Clean connection string if needed
if (connectionString && (connectionString.toLowerCase().endsWith('/herfunds') || connectionString.toLowerCase().endsWith('/herfunds/'))) {
  connectionString = connectionString.replace(/\/herfunds\/?$/i, '/postgres');
}

const pool = connectionString
  ? new pg.Pool({ 
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    })
  : new pg.Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      port: Number(process.env.DB_PORT) || 5432,
    });

// 🚀 Force automatic table creation on startup
export const initDB = async () => {
  try {
    console.log('Verifying and creating required database tables...');
    
    // Create users table
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

    // Create user_badges table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.user_badges (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES public.users(id) ON DELETE CASCADE,
        module_id INT NOT NULL,
        badge_name VARCHAR(255) NOT NULL,
        unlocked_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, module_id)
      );
    `);

    console.log('✅ Tables "users" and "user_badges" successfully verified/created!');
  } catch (err) {
    console.error('❌ Database table initialization failed:', err);
  }
};

// Execute initialization
initDB();

export default pool;

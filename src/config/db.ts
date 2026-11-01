import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';

const pool = connectionString
  ? new pg.Pool({
      connectionString,
      ssl: isProduction
        ? { rejectUnauthorized: false }
        : false,
      connectionTimeoutMillis: 10000,
    })
  : new pg.Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'herfunds',
      password: process.env.DB_PASSWORD || 'postgres',
      port: Number(process.env.DB_PORT) || 5432,
      ssl: false,
      connectionTimeoutMillis: 10000,
    });

pool.on('connect', () => {
  console.log('PostgreSQL connection established.');
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

export const initDB = async (): Promise<void> => {
  try {
    await pool.query('SELECT 1');
    console.log('Database connection verified successfully.');
  } catch (err) {
    console.error('Database connection failed:', err);
    throw err;
  }
};

export default pool;

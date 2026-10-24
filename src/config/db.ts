import pg from 'pg';
import dotenv from 'dotenv';

// Ensure environment variables are loaded regardless of import order
dotenv.config();

const connectionString = process.env.DATABASE_URL;

const pool = connectionString
  ? new pg.Pool({ connectionString })
  : new pg.Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'HerFunds',
      password: process.env.DB_PASSWORD || 'postgres',
      port: Number(process.env.DB_PORT) || 5432,
    });

export default pool;
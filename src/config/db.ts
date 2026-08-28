import pg from 'pg';

const pool = new pg.Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'HerFunds',
  password: 'postgres46822', // Put your master password here directly!
  port: 5432,
});

export default pool;
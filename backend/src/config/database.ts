import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Support both DATABASE_URL (Railway/Render) and individual vars
let poolConfig: any;
if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };
} else {
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'curo_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  };
}

// Essential: Prevent database overload with connection limits
poolConfig.max = parseInt(process.env.DB_POOL_MAX || '20'); // Max 20 connections - prevents overload
poolConfig.connectionTimeoutMillis = 5000; // Timeout if can't get connection in 5s - prevents hanging

export const pool = new Pool(poolConfig);

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

export default pool;


import { pool } from '../config/database';

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful!');
    console.log('Current time:', result.rows[0].now);
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Database connection failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. PostgreSQL is running');
    console.error('2. Database credentials in .env are correct');
    console.error('3. Database "curo_db" exists (create it if needed)');
    process.exit(1);
  }
}

testConnection();


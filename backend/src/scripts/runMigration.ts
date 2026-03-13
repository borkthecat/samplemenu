import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'curo_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  });

  try {
    // Read SQL file
    const sqlPath = path.join(__dirname, '../../migrations/001_initial_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute SQL file as a whole (PostgreSQL client handles multiple statements)
    console.log('📝 Running migration...');
    
    try {
      await pool.query(sql);
      console.log('✅ Migration completed successfully');
    } catch (error: any) {
      // Some errors are expected (like "already exists"), check if tables were created
      if (error.message.includes('already exists')) {
        console.log('⚠️  Some objects already exist (this is OK if re-running)');
      } else {
        throw error;
      }
    }

    console.log('✅ Migration completed successfully');
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();


import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function createDatabase() {
  // Connect to default 'postgres' database to create our database
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: 'postgres', // Connect to default database
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  });

  try {
    // Check if database exists
    const checkResult = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = 'curo_db'"
    );

    if (checkResult.rows.length > 0) {
      console.log('✅ Database "curo_db" already exists');
    } else {
      // Create database
      await adminPool.query('CREATE DATABASE curo_db');
      console.log('✅ Database "curo_db" created successfully');
    }

    await adminPool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error creating database:', error.message);
    await adminPool.end();
    process.exit(1);
  }
}

createDatabase();


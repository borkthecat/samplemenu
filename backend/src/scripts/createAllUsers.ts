import { pool } from '../config/database';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function createAllUsers() {
  const users = [
    { email: 'venue001@curo.sg', password: 'venue001pass', venueId: '001' },
    { email: 'venue002@curo.sg', password: 'venue002pass', venueId: '002' },
    { email: 'venue003@curo.sg', password: 'venue003pass', venueId: '003' },
  ];

  try {
    // Ensure users table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        venue_id VARCHAR(10) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'manager',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Users table ensured\n');

    for (const userData of users) {
      try {
        // Check if user already exists
        const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [userData.email.toLowerCase()]);
        if (existingUser.rows.length > 0) {
          console.log(`⏭️  User ${userData.email} already exists, skipping...`);
          continue;
        }

        // Hash password
        const passwordHash = await bcrypt.hash(userData.password, 10);

        // Create user
        const result = await pool.query(
          `INSERT INTO users (email, password_hash, venue_id, role)
           VALUES ($1, $2, $3, 'manager')
           RETURNING id, email, venue_id, role`,
          [userData.email.toLowerCase(), passwordHash, userData.venueId]
        );

        const user = result.rows[0];
        console.log(`✅ User created for Venue ${userData.venueId}:`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Password: ${userData.password}`);
        console.log(`   Venue ID: ${user.venue_id}\n`);
      } catch (error: any) {
        console.error(`❌ Error creating user ${userData.email}:`, error.message);
      }
    }

    console.log('✅ All users created successfully!');
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

createAllUsers();


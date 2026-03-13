import { pool } from '../config/database';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function createUser() {
  const email = process.argv[2];
  const password = process.argv[3];
  const venueId = process.argv[4];

  if (!email || !password || !venueId) {
    console.log('Usage: ts-node createUser.ts <email> <password> <venue_id>');
    console.log('Example: ts-node createUser.ts manager@venue002.com password123 002');
    process.exit(1);
  }

  try {
    // Check if user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      console.log(`❌ User with email ${email} already exists`);
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, venue_id, role)
       VALUES ($1, $2, $3, 'manager')
       RETURNING id, email, venue_id, role`,
      [email.toLowerCase(), passwordHash, venueId]
    );

    const user = result.rows[0];
    console.log('✅ User created successfully!');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Venue ID: ${user.venue_id}`);
    console.log(`   Role: ${user.role}`);

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error creating user:', error.message);
    await pool.end();
    process.exit(1);
  }
}

createUser();


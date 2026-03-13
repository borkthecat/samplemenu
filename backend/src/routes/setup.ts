import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import bcrypt from 'bcryptjs';

const router = Router();

// POST /api/setup/create-users
// One-time endpoint to create default users for all venues
// SECURITY: Remove this endpoint after creating users in production!
router.post('/create-users', async (req: Request, res: Response) => {
  try {
    // Optional: Add a secret key check for security
    const secretKey = req.body.secret_key || req.headers['x-setup-key'];
    if (secretKey !== process.env.SETUP_SECRET_KEY && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const users = [
      { email: 'venue001@curo.sg', password: 'venue001pass', venueId: '001' },
      { email: 'venue002@curo.sg', password: 'venue002pass', venueId: '002' },
      { email: 'venue003@curo.sg', password: 'venue003pass', venueId: '003' },
    ];

    // Ensure users table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        venue_id VARCHAR(10),
        role VARCHAR(50) NOT NULL DEFAULT 'manager',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Alter venue_id to allow NULL if it doesn't already (for admin users)
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' 
          AND column_name = 'venue_id' 
          AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE users ALTER COLUMN venue_id DROP NOT NULL;
        END IF;
      END $$;
    `);

    const results = [];

    for (const userData of users) {
      try {
        // Check if user already exists
        const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [userData.email.toLowerCase()]);
        if (existingUser.rows.length > 0) {
          results.push({
            email: userData.email,
            status: 'exists',
            message: 'User already exists'
          });
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
        results.push({
          email: user.email,
          venue_id: user.venue_id,
          status: 'created',
          message: 'User created successfully'
        });
      } catch (error: any) {
        results.push({
          email: userData.email,
          status: 'error',
          message: error.message
        });
      }
    }

    res.json({
      success: true,
      message: 'User creation completed',
      results: results
    });
  } catch (error: any) {
    console.error('Error creating users:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /api/setup/users
// Get all partner portal users
router.get('/users', async (req: Request, res: Response) => {
  try {
    // Check if users table exists, create if not
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        venue_id VARCHAR(10),
        role VARCHAR(50) NOT NULL DEFAULT 'manager',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Alter venue_id to allow NULL if it doesn't already (for admin users)
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' 
          AND column_name = 'venue_id' 
          AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE users ALTER COLUMN venue_id DROP NOT NULL;
        END IF;
      END $$;
    `);

    const result = await pool.query(
      'SELECT id, email, venue_id, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows || []);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    // Return empty array instead of error if table doesn't exist
    if (error.message && error.message.includes('does not exist')) {
      res.json([]);
    } else {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }
});

// POST /api/setup/create-user
// Create a single user
router.post('/create-user', async (req: Request, res: Response) => {
  try {
    const { email, password, venue_id, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate role
    const validRoles = ['manager', 'admin'];
    const userRole = role || 'manager';
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({ error: 'Invalid role. Must be "manager" or "admin"' });
    }

    // For managers, venue_id is required. For admins, venue_id is optional (can be null)
    if (userRole === 'manager' && !venue_id) {
      return res.status(400).json({ error: 'venue_id is required for manager role' });
    }

    // Validate venue_id if provided
    if (venue_id) {
      const validVenues = ['001', '002', '003'];
      if (!validVenues.includes(venue_id)) {
        return res.status(400).json({ error: 'Invalid venue_id. Must be 001, 002, or 003' });
      }
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Ensure users table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        venue_id VARCHAR(10),
        role VARCHAR(50) NOT NULL DEFAULT 'manager',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Alter venue_id to allow NULL if it doesn't already (for admin users)
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' 
          AND column_name = 'venue_id' 
          AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE users ALTER COLUMN venue_id DROP NOT NULL;
        END IF;
      END $$;
    `);

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, venue_id, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, venue_id, role, created_at`,
      [email.toLowerCase(), passwordHash, venue_id || null, userRole]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// DELETE /api/setup/users/:id
// Delete a user
router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id);

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;


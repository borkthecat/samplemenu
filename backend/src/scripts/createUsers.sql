-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  venue_id VARCHAR(10) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'manager',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Note: You need to hash the passwords first using bcrypt
-- These are example password hashes for 'venue001pass', 'venue002pass', 'venue003pass'
-- You'll need to generate these using the createUser script or bcrypt

-- For now, let's create a simpler approach - use the Node.js script
-- But here's the SQL structure:

-- To create users, you need to:
-- 1. Hash the passwords using bcrypt (cost factor 10)
-- 2. Insert them into the users table

-- Example (you'll need to replace the password_hash with actual bcrypt hashes):
-- INSERT INTO users (email, password_hash, venue_id, role)
-- VALUES 
--   ('venue001@curo.sg', '$2a$10$...', '001', 'manager'),
--   ('venue002@curo.sg', '$2a$10$...', '002', 'manager'),
--   ('venue003@curo.sg', '$2a$10$...', '003', 'manager')
-- ON CONFLICT (email) DO NOTHING;


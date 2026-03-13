-- Add password reset functionality
-- Run this with: psql -U postgres -d curo_db -f migrations/003_add_password_reset.sql

-- Add reset token fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL;


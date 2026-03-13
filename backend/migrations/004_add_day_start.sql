-- Add day_started_at column to users table for manual day reset
-- Run this with: psql -U postgres -d curo_db -f migrations/004_add_day_start.sql

-- Add day_started_at column to track when the current "day" started
ALTER TABLE users ADD COLUMN IF NOT EXISTS day_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_day_started_at ON users(day_started_at) WHERE day_started_at IS NOT NULL;


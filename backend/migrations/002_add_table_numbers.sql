-- Add table_numbers table for QR code validation
-- Run this with: psql -U postgres -d curo_db -f migrations/002_add_table_numbers.sql

CREATE TABLE IF NOT EXISTS table_numbers (
    id SERIAL PRIMARY KEY,
    table_number VARCHAR(50) NOT NULL,
    venue_id VARCHAR(10) REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
    qr_token VARCHAR(100) UNIQUE NOT NULL,
    qr_code_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(venue_id, table_number)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_table_numbers_venue ON table_numbers(venue_id);
CREATE INDEX IF NOT EXISTS idx_table_numbers_lookup ON table_numbers(venue_id, table_number);


-- Add daily_revenue_logs table for tracking daily revenue when venues close
-- Run this with: psql -U postgres -d curo_db -f migrations/003_add_daily_revenue_logs.sql

CREATE TABLE IF NOT EXISTS daily_revenue_logs (
    id SERIAL PRIMARY KEY,
    venue_id VARCHAR(10) REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    revenue DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    gst DECIMAL(10, 2) NOT NULL,
    orders_count INTEGER NOT NULL,
    closed_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(venue_id, date)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_revenue_logs_venue ON daily_revenue_logs(venue_id);
CREATE INDEX IF NOT EXISTS idx_daily_revenue_logs_date ON daily_revenue_logs(date DESC);


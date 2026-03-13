-- Migration: Add order archiving support
-- This migration adds indexes and prepares for order archiving
-- Run with: psql -U postgres -d curo_db -f migrations/005_add_order_archiving.sql

-- Add composite index for date range queries (used in analytics)
CREATE INDEX IF NOT EXISTS idx_orders_venue_payment_created 
ON orders(venue_id, payment_status, created_at DESC) 
WHERE payment_status = 'PAID';

-- Add index for order_number lookups (already unique, but this helps with searches)
CREATE INDEX IF NOT EXISTS idx_orders_order_number_lookup 
ON orders(order_number);

-- Create archive table for old orders (optional - for manual archiving)
-- This table structure matches orders but is for historical data
CREATE TABLE IF NOT EXISTS orders_archive (
    id INTEGER PRIMARY KEY, -- Keep original ID for reference
    order_number VARCHAR(50) NOT NULL,
    venue_id VARCHAR(10) NOT NULL,
    table_number VARCHAR(20),
    phone_number VARCHAR(20),
    customer_name VARCHAR(100),
    status VARCHAR(20) NOT NULL,
    payment_status VARCHAR(20) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create archive table for order items
CREATE TABLE IF NOT EXISTS order_items_archive (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL,
    menu_item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for archive tables
CREATE INDEX IF NOT EXISTS idx_orders_archive_venue ON orders_archive(venue_id);
CREATE INDEX IF NOT EXISTS idx_orders_archive_created ON orders_archive(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_archive_archived ON orders_archive(archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_archive_order ON order_items_archive(order_id);

-- Add comment explaining archiving strategy
COMMENT ON TABLE orders_archive IS 'Archived orders older than retention period. Use for historical reporting.';
COMMENT ON TABLE order_items_archive IS 'Archived order items corresponding to archived orders.';


-- Clear All Test Data
-- WARNING: This will delete ALL orders and revenue data!
-- Run this in Railway's database console before production deployment

BEGIN;

-- Delete all order items
DELETE FROM order_items;

-- Delete all orders
DELETE FROM orders;

-- Delete all revenue logs
DELETE FROM daily_revenue_logs;

-- Clear archive tables (if they exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_items_archive') THEN
        DELETE FROM order_items_archive;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders_archive') THEN
        DELETE FROM orders_archive;
    END IF;
END $$;

-- Reset sequences
DO $$
BEGIN
    -- Reset orders sequence
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'orders_id_seq') THEN
        ALTER SEQUENCE orders_id_seq RESTART WITH 1;
    END IF;
    
    -- Reset order_items sequence
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'order_items_id_seq') THEN
        ALTER SEQUENCE order_items_id_seq RESTART WITH 1;
    END IF;
    
    -- Reset daily_revenue_logs sequence
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'daily_revenue_logs_id_seq') THEN
        ALTER SEQUENCE daily_revenue_logs_id_seq RESTART WITH 1;
    END IF;
END $$;

COMMIT;

-- Verification queries (run these after to confirm):
-- SELECT COUNT(*) FROM orders;           -- Should be 0
-- SELECT COUNT(*) FROM order_items;       -- Should be 0
-- SELECT COUNT(*) FROM daily_revenue_logs; -- Should be 0


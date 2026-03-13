-- Add doneness column to order_items table
-- Run this in Railway PostgreSQL database

ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS doneness VARCHAR(50);

-- Verify it was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'order_items' AND column_name = 'doneness';


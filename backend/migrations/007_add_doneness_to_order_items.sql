-- Add doneness column to order_items table for steak items
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS doneness VARCHAR(50);

-- Add comment
COMMENT ON COLUMN order_items.doneness IS 'Doneness level for steak items (RARE, MEDIUM RARE, MEDIUM, WELL DONE)';


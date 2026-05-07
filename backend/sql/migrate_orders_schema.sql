-- Migration Script: Add tracking ID and shipping service support to orders table
-- This script updates the orders table to support 6-digit unique tracking IDs and shipping service selection

-- Step 1: Add new columns to orders table
ALTER TABLE orders 
ADD COLUMN tracking_id VARCHAR(6) UNIQUE NULL AFTER tracking_id,
ADD COLUMN shipping_service ENUM('DTDC','Shree Maruti','Delhivery','India Post','Ekart') NULL AFTER tracking_id;

-- Step 2: Create index on tracking_id for faster lookups
CREATE INDEX idx_orders_tracking_id ON orders(tracking_id);

-- Step 3: For existing orders, generate unique 6-digit tracking IDs if they don't have one
-- You can run this after migrating, or manually update via application

-- Verification query - check if migration was successful
SELECT 
  COLUMN_NAME, 
  COLUMN_TYPE, 
  IS_NULLABLE, 
  COLUMN_KEY 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'orders' 
AND COLUMN_NAME IN ('tracking_id', 'shipping_service')
ORDER BY ORDINAL_POSITION;

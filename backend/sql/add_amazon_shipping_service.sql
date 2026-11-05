-- Apply to the intended application database after checking the existing column.
-- Append Amazon Shipping after Shadowfax to preserve existing ENUM indexes.
-- INPLACE/LOCK=NONE refuses a table-copy operation on unsupported server versions.
ALTER TABLE orders
  MODIFY COLUMN shipping_service ENUM('DTDC','Shree Maruti','Delhivery','India Post','Ekart','Shadowfax','Amazon Shipping') NULL DEFAULT NULL,
  ALGORITHM=INPLACE,
  LOCK=NONE;

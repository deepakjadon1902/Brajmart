-- Apply to the intended application database after checking the existing column.
-- Append the new courier to preserve every existing ENUM value and numeric index.
-- INPLACE/LOCK=NONE refuses a table-copy operation on unsupported server versions.
ALTER TABLE orders
  MODIFY COLUMN shipping_service ENUM('DTDC','Shree Maruti','Delhivery','India Post','Ekart','Shadowfax') NULL DEFAULT NULL,
  ALGORITHM=INPLACE,
  LOCK=NONE;

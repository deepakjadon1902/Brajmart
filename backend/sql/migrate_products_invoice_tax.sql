-- Reviewed, owner-run migration. Does not modify orders or set tax rates.
-- Idempotent: existing values are preserved. NULL GST means not configured.
SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'hsn_code') = 0,
  'ALTER TABLE products ADD COLUMN hsn_code VARCHAR(8) NULL',
  'SELECT "hsn_code already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'unit') = 0,
  'ALTER TABLE products ADD COLUMN unit VARCHAR(16) NULL',
  'SELECT "unit already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'gst_rate') = 0,
  'ALTER TABLE products ADD COLUMN gst_rate DECIMAL(5,2) NULL',
  'SELECT "gst_rate already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

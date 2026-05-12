-- BrajMart products variants + attributes (one-time migration)
-- Adds the following columns to `products`:
--   sizes JSON NULL
--   size_pricing JSON NULL
--   piece_pricing JSON NULL
--   attributes JSON NULL
--   variant_pricing JSON NULL
--
-- Note: This will ERROR if any of these columns already exist.
-- If you already ran an older migration, use the "safe" migration below instead.

ALTER TABLE products
  ADD COLUMN sizes JSON NULL AFTER description,
  ADD COLUMN size_pricing JSON NULL AFTER sizes,
  ADD COLUMN piece_pricing JSON NULL AFTER size_pricing,
  ADD COLUMN attributes JSON NULL AFTER piece_pricing,
  ADD COLUMN variant_pricing JSON NULL AFTER attributes;

-- ---------------------------
-- Safe migration (run instead if you're not sure what exists)
-- This will add only missing columns using INFORMATION_SCHEMA checks.
-- ---------------------------

SET @tbl := 'products';

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = 'sizes') = 0,
  'ALTER TABLE products ADD COLUMN sizes JSON NULL AFTER description',
  'SELECT \"sizes already exists\"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = 'size_pricing') = 0,
  'ALTER TABLE products ADD COLUMN size_pricing JSON NULL AFTER sizes',
  'SELECT \"size_pricing already exists\"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = 'piece_pricing') = 0,
  'ALTER TABLE products ADD COLUMN piece_pricing JSON NULL AFTER size_pricing',
  'SELECT \"piece_pricing already exists\"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = 'attributes') = 0,
  'ALTER TABLE products ADD COLUMN attributes JSON NULL AFTER piece_pricing',
  'SELECT \"attributes already exists\"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = 'variant_pricing') = 0,
  'ALTER TABLE products ADD COLUMN variant_pricing JSON NULL AFTER attributes',
  'SELECT \"variant_pricing already exists\"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


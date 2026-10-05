-- Product home-page placement flag.
-- Safe to run multiple times.

SET @tbl := 'products';

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = 'show_on_home') = 0,
  'ALTER TABLE products ADD COLUMN show_on_home TINYINT(1) NOT NULL DEFAULT 0 AFTER tags',
  'SELECT "show_on_home already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND INDEX_NAME = 'idx_products_show_on_home') = 0,
  'CREATE INDEX idx_products_show_on_home ON products (show_on_home)',
  'SELECT "idx_products_show_on_home already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

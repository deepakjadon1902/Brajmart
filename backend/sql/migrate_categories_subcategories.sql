-- Brajmart: Categories/Subcategories + stable product category references
-- Safe to run multiple times (guards included where possible).

-- 1) Subcategories table
CREATE TABLE IF NOT EXISTS subcategories (
  id INT NOT NULL AUTO_INCREMENT,
  category_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_subcategories_category_id (category_id),
  UNIQUE KEY uq_subcategories_category_name (category_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) Stable product pointers (keeps products attached when category name changes)
-- NOTE: Run these only once if your MySQL version doesn't support IF NOT EXISTS for columns.
-- You can comment them out if columns already exist.
ALTER TABLE products ADD COLUMN category_id INT NULL AFTER category;
ALTER TABLE products ADD COLUMN subcategory_id INT NULL AFTER category_id;

-- 3) Backfill category_id from legacy products.category (name)
UPDATE products p
JOIN categories c ON p.category = c.name
SET p.category_id = c.id
WHERE (p.category_id IS NULL OR p.category_id = 0) AND p.category IS NOT NULL AND p.category <> '';


-- Delivery Service Partner COD rules. Safe to run more than once.

SET @add_products_cod_enabled = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE products ADD COLUMN cod_enabled TINYINT(1) NULL AFTER in_stock',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'cod_enabled'
);
PREPARE stmt FROM @add_products_cod_enabled;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_categories_cod_enabled = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE categories ADD COLUMN cod_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER product_count',
    'SELECT 1'
  )
  FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'categories' AND column_name = 'cod_enabled'
);
PREPARE stmt FROM @add_categories_cod_enabled;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS delivery_pincode_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  pincode VARCHAR(6) NOT NULL,
  delivery_enabled TINYINT(1) NOT NULL DEFAULT 1,
  cod_enabled TINYINT(1) NOT NULL DEFAULT 1,
  partner_name VARCHAR(120) NOT NULL DEFAULT 'Delivery Service Partner',
  note VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_delivery_pincode_rules_pincode (pincode),
  KEY idx_delivery_pincode_rules_cod (cod_enabled, delivery_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

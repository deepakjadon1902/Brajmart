-- Provision the schema used by the current checkout and Razorpay order flow.
-- Safe to rerun: existing columns are detected and the tables use IF NOT EXISTS.
-- Review any custom orders.status values before applying the ENUM update.

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'settings' AND column_name = 'cod_fee') = 0,
  'ALTER TABLE settings ADD COLUMN cod_fee DECIMAL(10,2) NOT NULL DEFAULT 40',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'settings' AND column_name = 'packaging_rate') = 0,
  'ALTER TABLE settings ADD COLUMN packaging_rate DECIMAL(5,2) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'settings' AND column_name = 'tax_rate') = 0,
  'ALTER TABLE settings ADD COLUMN tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'settings' AND column_name = 'cod_enabled') = 0,
  'ALTER TABLE settings ADD COLUMN cod_enabled TINYINT(1) NOT NULL DEFAULT 1',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'settings' AND column_name = 'min_order_amount') = 0,
  'ALTER TABLE settings ADD COLUMN min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'settings' AND column_name = 'max_order_quantity') = 0,
  'ALTER TABLE settings ADD COLUMN max_order_quantity INT NOT NULL DEFAULT 10',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'sku') = 0,
  'ALTER TABLE products ADD COLUMN sku VARCHAR(120) NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'stock_quantity') = 0,
  'ALTER TABLE products ADD COLUMN stock_quantity INT NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'reserved_quantity') = 0,
  'ALTER TABLE products ADD COLUMN reserved_quantity INT NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'low_stock_threshold') = 0,
  'ALTER TABLE products ADD COLUMN low_stock_threshold INT NOT NULL DEFAULT 3',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'cod_enabled') = 0,
  'ALTER TABLE products ADD COLUMN cod_enabled TINYINT(1) NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'archived_at') = 0,
  'ALTER TABLE products ADD COLUMN archived_at DATETIME NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'archived_by') = 0,
  'ALTER TABLE products ADD COLUMN archived_by VARCHAR(120) NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'archive_reason') = 0,
  'ALTER TABLE products ADD COLUMN archive_reason VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'categories' AND column_name = 'cod_enabled') = 0,
  'ALTER TABLE categories ADD COLUMN cod_enabled TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'categories' AND column_name = 'archived_at') = 0,
  'ALTER TABLE categories ADD COLUMN archived_at DATETIME NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'categories' AND column_name = 'archived_by') = 0,
  'ALTER TABLE categories ADD COLUMN archived_by VARCHAR(120) NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'categories' AND column_name = 'archive_reason') = 0,
  'ALTER TABLE categories ADD COLUMN archive_reason VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'coupon_code') = 0,
  'ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(80) NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'coupon_discount') = 0,
  'ALTER TABLE orders ADD COLUMN coupon_discount DECIMAL(10,2) NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'coupon_details') = 0,
  'ALTER TABLE orders ADD COLUMN coupon_details JSON NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'items_subtotal') = 0,
  'ALTER TABLE orders ADD COLUMN items_subtotal DECIMAL(10,2) NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'packaging_amount') = 0,
  'ALTER TABLE orders ADD COLUMN packaging_amount DECIMAL(10,2) NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'packaging_rate') = 0,
  'ALTER TABLE orders ADD COLUMN packaging_rate DECIMAL(5,2) NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'shipping_amount') = 0,
  'ALTER TABLE orders ADD COLUMN shipping_amount DECIMAL(10,2) NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'cod_amount') = 0,
  'ALTER TABLE orders ADD COLUMN cod_amount DECIMAL(10,2) NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'cod_available') = 0,
  'ALTER TABLE orders ADD COLUMN cod_available TINYINT(1) NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'cod_pincode') = 0,
  'ALTER TABLE orders ADD COLUMN cod_pincode VARCHAR(10) NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'cod_message') = 0,
  'ALTER TABLE orders ADD COLUMN cod_message TEXT NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

ALTER TABLE orders MODIFY COLUMN status
  ENUM('pending_payment','confirmed','processing','shipped','out_for_delivery','delivered','rto','cancelled')
  NOT NULL DEFAULT 'confirmed';

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  type ENUM('RESTOCK','RESERVE','RELEASE','SALE','ADJUSTMENT','CANCELLATION','RETURN') NOT NULL,
  quantity INT NOT NULL,
  previous_quantity INT NULL,
  new_quantity INT NULL,
  previous_reserved INT NULL,
  new_reserved INT NULL,
  reason VARCHAR(255) NOT NULL DEFAULT '',
  created_by VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_transactions_product (product_id),
  KEY idx_inventory_transactions_order (order_id),
  CONSTRAINT fk_inventory_transactions_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_transactions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS checkout_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  idempotency_key VARCHAR(120) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  customer_email VARCHAR(255) NOT NULL DEFAULT '',
  cart_hash VARCHAR(64) NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  payment_token VARCHAR(255) NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status ENUM('active','paid','failed','cancelled','expired') NOT NULL DEFAULT 'active',
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_checkout_sessions_key (idempotency_key),
  KEY idx_checkout_sessions_order (order_id),
  KEY idx_checkout_sessions_token (payment_token),
  KEY idx_checkout_sessions_status_expires (status, expires_at),
  CONSTRAINT fk_checkout_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_checkout_sessions_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS coupons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(80) NOT NULL,
  title VARCHAR(255) NULL,
  discount_type ENUM('amount','percent') NOT NULL DEFAULT 'amount',
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_discount DECIMAL(10,2) NULL,
  free_shipping TINYINT(1) NOT NULL DEFAULT 0,
  free_packaging TINYINT(1) NOT NULL DEFAULT 0,
  scope_type ENUM('all','product','category') NOT NULL DEFAULT 'all',
  scope_value VARCHAR(255) NULL,
  min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  usage_limit INT NULL,
  used_count INT NOT NULL DEFAULT 0,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  archived_at DATETIME NULL,
  archived_by VARCHAR(120) NULL,
  archive_reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_coupons_code (code),
  KEY idx_coupons_active_code (is_active, code),
  KEY idx_coupons_archived_active (archived_at, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'coupons' AND column_name = 'archived_at') = 0,
  'ALTER TABLE coupons ADD COLUMN archived_at DATETIME NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'coupons' AND column_name = 'archived_by') = 0,
  'ALTER TABLE coupons ADD COLUMN archived_by VARCHAR(120) NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

SET @bm_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'coupons' AND column_name = 'archive_reason') = 0,
  'ALTER TABLE coupons ADD COLUMN archive_reason VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE bm_stmt FROM @bm_sql; EXECUTE bm_stmt; DEALLOCATE PREPARE bm_stmt;

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

-- Verification: both queries should return the required checkout schema.
SHOW COLUMNS FROM orders LIKE 'status';
SHOW TABLES LIKE 'checkout_sessions';

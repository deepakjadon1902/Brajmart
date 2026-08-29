-- Phase 0 commerce integrity migration for BrajMart.
-- Safe rollout: additive only. Existing products keep legacy in_stock behavior
-- until stock_quantity is set by admin.

ALTER TABLE settings
  ADD COLUMN cod_fee DECIMAL(10,2) NOT NULL DEFAULT 40 AFTER cod_enabled;

ALTER TABLE products
  ADD COLUMN stock_quantity INT NULL AFTER in_stock,
  ADD COLUMN reserved_quantity INT NOT NULL DEFAULT 0 AFTER stock_quantity,
  ADD COLUMN low_stock_threshold INT NOT NULL DEFAULT 3 AFTER reserved_quantity,
  ADD COLUMN sku VARCHAR(120) NULL AFTER slug;

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

-- Rollback strategy:
-- Drop checkout_sessions and inventory_transactions only after confirming no active sessions.
-- Drop added columns only after deploying code that no longer references them.

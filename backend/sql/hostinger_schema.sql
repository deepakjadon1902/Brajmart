-- Hostinger MySQL schema for BrajMart
-- Create database first (example): CREATE DATABASE brajmart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(40) DEFAULT '',
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  status ENUM('active','blocked') NOT NULL DEFAULT 'active',
  google_id VARCHAR(255) NULL,
  avatar VARCHAR(1024) DEFAULT '',
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  verification_token VARCHAR(255) NULL,
  verification_token_expires DATETIME NULL,
  addresses JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admins (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT 'Admin',
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  status ENUM('active','blocked') NOT NULL DEFAULT 'active',
  last_login DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  icon VARCHAR(255) NOT NULL,
  color VARCHAR(50) NOT NULL DEFAULT '#f59e0b',
  product_count INT NOT NULL DEFAULT 0,
  cod_enabled TINYINT(1) NOT NULL DEFAULT 0,
  display_order INT NOT NULL DEFAULT 0,
  archived_at DATETIME NULL,
  archived_by VARCHAR(120) NULL,
  archive_reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  sku VARCHAR(120) NULL,
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2) NULL,
  hsn_code VARCHAR(8) NULL,
  unit VARCHAR(16) NULL,
  gst_rate DECIMAL(5,2) NULL,
  image VARCHAR(1024) NOT NULL,
  images JSON NULL,
  category VARCHAR(255) NOT NULL,
  rating DECIMAL(3,2) NOT NULL DEFAULT 0,
  review_count INT NOT NULL DEFAULT 0,
  badge VARCHAR(50) NULL,
  tags JSON NULL,
  in_stock TINYINT(1) NOT NULL DEFAULT 1,
  sold_count INT NOT NULL DEFAULT 0,
  description TEXT NULL,
  sizes JSON NULL,
  size_pricing JSON NULL,
  piece_pricing JSON NULL,
  cod_enabled TINYINT(1) NULL,
  stock_quantity INT NULL,
  reserved_quantity INT NOT NULL DEFAULT 0,
  low_stock_threshold INT NOT NULL DEFAULT 3,
  archived_at DATETIME NULL,
  archived_by VARCHAR(120) NULL,
  archive_reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS carts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  items JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wishlists (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL UNIQUE,
  items JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_wishlists_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  items JSON NOT NULL,
  items_subtotal DECIMAL(10,2) NULL,
  packaging_amount DECIMAL(10,2) NULL,
  packaging_rate DECIMAL(5,2) NULL,
  shipping_amount DECIMAL(10,2) NULL,
  cod_amount DECIMAL(10,2) NULL,
  cod_available TINYINT(1) NULL,
  cod_pincode VARCHAR(10) NULL,
  cod_message TEXT NULL,
  coupon_code VARCHAR(80) NULL,
  coupon_discount DECIMAL(10,2) NULL,
  coupon_details JSON NULL,
  total DECIMAL(10,2) NOT NULL,
  status ENUM('pending_payment','confirmed','processing','shipped','out_for_delivery','delivered','rto','cancelled') NOT NULL DEFAULT 'confirmed',
  customer_name VARCHAR(255) NULL,
  customer_email VARCHAR(255) NULL,
  shipping_address JSON NOT NULL,
  billing_address JSON NOT NULL,
  payment_method VARCHAR(100) NOT NULL,
    tracking_id VARCHAR(255) UNIQUE NULL,
    shipping_service ENUM('DTDC','Shree Maruti','Delhivery','India Post','Ekart','Shadowfax','Amazon Shipping') NULL,
    estimated_delivery DATETIME NULL,
    status_history JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orders_user_id (user_id),
  INDEX idx_orders_tracking_id (tracking_id),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

-- Start order IDs from 10000 (optional, matches previous Mongo counter style)
ALTER TABLE orders AUTO_INCREMENT = 10000;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  method VARCHAR(100) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('paid','pending','failed','refunded') NOT NULL DEFAULT 'pending',
  transaction_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payments_order (order_id),
  INDEX idx_payments_txn (transaction_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_status (
  token VARCHAR(255) PRIMARY KEY,
  status ENUM('paid','pending','failed') NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  amount DECIMAL(10,2) NULL,
  method VARCHAR(100) NULL,
  payment_id VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payment_status_order (order_id)
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

CREATE TABLE IF NOT EXISTS settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  store_name VARCHAR(255) NOT NULL DEFAULT 'BrajMart',
  tagline VARCHAR(255) NOT NULL DEFAULT 'From Braj, With Love',
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  free_shipping_threshold DECIMAL(10,2) NOT NULL DEFAULT 299,
  shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 49,
  store_email VARCHAR(255) NOT NULL DEFAULT 'support@brajmart.com',
  store_phone VARCHAR(50) NOT NULL DEFAULT '+91 9876543210',
  store_address VARCHAR(255) NOT NULL DEFAULT 'Vrindavan, Mathura, UP 281121, India',
  packaging_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_order_quantity INT NOT NULL DEFAULT 10,
  delivery_eta_min_days INT NOT NULL DEFAULT 3,
  delivery_eta_max_days INT NOT NULL DEFAULT 7,
  cod_enabled TINYINT(1) NOT NULL DEFAULT 1,
  cod_fee DECIMAL(10,2) NOT NULL DEFAULT 40,
  upi_enabled TINYINT(1) NOT NULL DEFAULT 1,
  card_enabled TINYINT(1) NOT NULL DEFAULT 1,
  maintenance_mode TINYINT(1) NOT NULL DEFAULT 0,
  meta_title VARCHAR(255) NOT NULL DEFAULT 'BrajMart - Authentic Vrindavan Products',
  meta_description TEXT NULL,
  store_logo VARCHAR(1024) NOT NULL DEFAULT '',
  favicon VARCHAR(1024) NOT NULL DEFAULT '',
  social_links JSON NULL,
  announcement_bar JSON NULL,
  notifications JSON NULL,
  hero_badges JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hero_slides (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tag VARCHAR(255) NOT NULL DEFAULT '',
  title VARCHAR(255) NOT NULL,
  subtitle TEXT NULL,
  cta VARCHAR(255) NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  overlay VARCHAR(255) NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS blogs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  excerpt TEXT NULL,
  content LONGTEXT NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT '',
  cover_image VARCHAR(1024) NOT NULL DEFAULT '',
  author VARCHAR(255) NOT NULL DEFAULT 'BrajMart Team',
  read_time INT NOT NULL DEFAULT 5,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  published_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_blogs_status (status),
  INDEX idx_blogs_published_at (published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

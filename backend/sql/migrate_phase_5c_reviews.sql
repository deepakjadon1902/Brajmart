-- Phase 5C real reviews and verified-purchase trust system.
-- Additive only. Do not drop, truncate, mass delete, or convert legacy product ratings.

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  title VARCHAR(120) NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status ENUM('PENDING','APPROVED','REJECTED','HIDDEN') NOT NULL DEFAULT 'PENDING',
  is_verified_purchase TINYINT(1) NOT NULL DEFAULT 1,
  helpful_count INT NOT NULL DEFAULT 0,
  report_count INT NOT NULL DEFAULT 0,
  approved_at DATETIME NULL,
  rejected_at DATETIME NULL,
  hidden_at DATETIME NULL,
  rejection_reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reviews_user_product_order (user_id, product_id, order_id),
  KEY idx_reviews_product_status_created (product_id, status, created_at),
  KEY idx_reviews_user_product (user_id, product_id),
  KEY idx_reviews_status_created (status, created_at),
  KEY idx_reviews_order (order_id),
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

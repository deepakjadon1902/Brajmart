-- Phase 5D commerce intelligence and admin-curated bundles.
-- Additive only. Does not modify payment, inventory, or order schemas.

CREATE TABLE IF NOT EXISTS bundles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(180) NOT NULL,
  description TEXT NULL,
  image_url VARCHAR(1024) NULL,
  display_location VARCHAR(80) NOT NULL DEFAULT 'product_detail',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  created_by VARCHAR(120) NULL,
  updated_by VARCHAR(120) NULL,
  archived_at DATETIME NULL,
  archived_by VARCHAR(120) NULL,
  archive_reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bundles_slug (slug),
  KEY idx_bundles_active_location (is_active, display_location, sort_order),
  KEY idx_bundles_archived (archived_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bundle_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bundle_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bundle_products_item (bundle_id, product_id),
  KEY idx_bundle_products_bundle_sort (bundle_id, sort_order),
  KEY idx_bundle_products_product (product_id),
  CONSTRAINT fk_bundle_products_bundle FOREIGN KEY (bundle_id) REFERENCES bundles(id) ON DELETE CASCADE,
  CONSTRAINT fk_bundle_products_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Phase 5B admin safety, archive metadata, and centralized audit logging.
-- Additive/idempotent intent: do not drop, truncate, mass delete, or rewrite production data.

ALTER TABLE products
  ADD COLUMN archived_at DATETIME NULL AFTER updated_at,
  ADD COLUMN archived_by VARCHAR(120) NULL AFTER archived_at,
  ADD COLUMN archive_reason VARCHAR(255) NULL AFTER archived_by;

ALTER TABLE categories
  ADD COLUMN archived_at DATETIME NULL AFTER updated_at,
  ADD COLUMN archived_by VARCHAR(120) NULL AFTER archived_at,
  ADD COLUMN archive_reason VARCHAR(255) NULL AFTER archived_by;

ALTER TABLE subcategories
  ADD COLUMN archived_at DATETIME NULL AFTER updated_at,
  ADD COLUMN archived_by VARCHAR(120) NULL AFTER archived_at,
  ADD COLUMN archive_reason VARCHAR(255) NULL AFTER archived_by;

ALTER TABLE blogs
  ADD COLUMN archived_at DATETIME NULL AFTER updated_at,
  ADD COLUMN archived_by VARCHAR(120) NULL AFTER archived_at,
  ADD COLUMN archive_reason VARCHAR(255) NULL AFTER archived_by;

ALTER TABLE coupons
  ADD COLUMN archived_at DATETIME NULL AFTER updated_at,
  ADD COLUMN archived_by VARCHAR(120) NULL AFTER archived_at,
  ADD COLUMN archive_reason VARCHAR(255) NULL AFTER archived_by;

ALTER TABLE collections
  ADD COLUMN archived_at DATETIME NULL AFTER updated_at,
  ADD COLUMN archived_by VARCHAR(120) NULL AFTER archived_at,
  ADD COLUMN archive_reason VARCHAR(255) NULL AFTER archived_by;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id VARCHAR(80) NULL,
  admin_email VARCHAR(255) NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(120) NOT NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  reason VARCHAR(255) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_audit_created (created_at),
  KEY idx_admin_audit_action (action),
  KEY idx_admin_audit_entity (entity_type, entity_id),
  KEY idx_admin_audit_admin (admin_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

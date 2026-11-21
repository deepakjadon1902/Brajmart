-- Apply to the existing BrajMart database before rolling out the new rate.
ALTER TABLE settings ALTER COLUMN shipping_fee SET DEFAULT 69;

CREATE TABLE IF NOT EXISTS app_migrations (
  id INT NOT NULL AUTO_INCREMENT,
  migration_key VARCHAR(190) NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_app_migrations_key (migration_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Apply the price change once so reruns preserve any later admin changes.
START TRANSACTION;
INSERT IGNORE INTO app_migrations (migration_key) VALUES ('2026-11-21_standard_shipping_fee_69');
SET @apply_standard_shipping_fee := ROW_COUNT();
UPDATE settings SET shipping_fee = 69 WHERE shipping_fee = 49 AND @apply_standard_shipping_fee = 1;
COMMIT;

-- BrajMart cart reminders, email preferences, WhatsApp consent, and coupon offers.
-- Review the target database identity and take a verified backup before executing.
-- This creates tables only; it does not enroll existing customers or send messages.

CREATE TABLE IF NOT EXISTS email_contact_preferences (
  email VARCHAR(255) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  customer_name VARCHAR(255) NOT NULL DEFAULT '',
  cart_reminder_consent TINYINT(1) NOT NULL DEFAULT 0,
  offer_email_consent TINYINT(1) NOT NULL DEFAULT 0,
  whatsapp_followup_consent TINYINT(1) NOT NULL DEFAULT 0,
  cart_reminder_consented_at DATETIME NULL,
  offer_email_consented_at DATETIME NULL,
  whatsapp_followup_consented_at DATETIME NULL,
  consent_source VARCHAR(40) NOT NULL DEFAULT '',
  consent_version VARCHAR(40) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (email),
  KEY idx_email_contact_preferences_user (user_id),
  KEY idx_email_contact_preferences_offers (offer_email_consent, email),
  KEY idx_email_contact_preferences_whatsapp (whatsapp_followup_consent, email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cart_reminder_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  customer_name VARCHAR(255) NOT NULL DEFAULT '',
  items JSON NOT NULL,
  items_subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  activity_at DATETIME NOT NULL,
  due_at DATETIME NOT NULL,
  status ENUM('pending','sending','sent','cancelled','failed','uncertain') NOT NULL DEFAULT 'pending',
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  idempotency_key CHAR(64) NOT NULL,
  last_error VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_reminder_idempotency (idempotency_key),
  KEY idx_cart_reminder_due (status, due_at),
  KEY idx_cart_reminder_email_status (email, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS email_unsubscribe_tokens (
  token_hash CHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME NULL,
  PRIMARY KEY (token_hash),
  KEY idx_email_unsubscribe_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS offer_email_deliveries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_key CHAR(64) NOT NULL,
  coupon_id BIGINT UNSIGNED NOT NULL,
  email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL DEFAULT '',
  status ENUM('pending','sending','sent','failed','uncertain','cancelled') NOT NULL DEFAULT 'pending',
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  idempotency_key CHAR(64) NOT NULL,
  last_error VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_offer_campaign_recipient (campaign_key, email),
  UNIQUE KEY uq_offer_email_idempotency (idempotency_key),
  KEY idx_offer_email_queue (status, id),
  CONSTRAINT fk_offer_email_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

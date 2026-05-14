-- Adds password reset OTP storage table
CREATE TABLE IF NOT EXISTS password_reset_otps (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  otp_hash VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  consumed TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_password_reset_user (user_id),
  INDEX idx_password_reset_created (created_at),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


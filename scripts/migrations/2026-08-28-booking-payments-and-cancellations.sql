ALTER TABLE bookings
  ADD COLUMN cancelledByUid VARCHAR(128) DEFAULT NULL AFTER reasonForCancellation,
  ADD COLUMN cancelledAt DATETIME DEFAULT NULL AFTER cancelledByUid,
  ADD COLUMN refundStatus ENUM('not_required', 'pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'not_required' AFTER cancelledAt;

ALTER TABLE booking_quotes
  ADD COLUMN rejection_reason ENUM('price', 'scope', 'timeline', 'materials', 'inspection', 'other') DEFAULT NULL AFTER status,
  ADD COLUMN rejection_note TEXT DEFAULT NULL AFTER rejection_reason;

CREATE TABLE IF NOT EXISTS booking_payment_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id INT NOT NULL,
  quote_id BIGINT UNSIGNED NOT NULL,
  marketplace_payment_intent_id BIGINT UNSIGNED DEFAULT NULL,
  client_uid VARCHAR(128) NOT NULL,
  provider VARCHAR(30) NOT NULL DEFAULT 'paystack',
  provider_reference VARCHAR(100) NOT NULL,
  amount_kobo BIGINT UNSIGNED NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  bank_name VARCHAR(120) NOT NULL,
  bank_slug VARCHAR(120) DEFAULT NULL,
  account_name VARCHAR(160) NOT NULL,
  account_number VARCHAR(30) NOT NULL,
  status ENUM('active', 'paid', 'expired', 'cancelled', 'rejected', 'failed') NOT NULL DEFAULT 'active',
  expires_at DATETIME NOT NULL,
  paid_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_booking_payment_provider_reference (provider, provider_reference),
  INDEX idx_booking_payment_booking_status (booking_id, status),
  INDEX idx_booking_payment_client_created (client_uid, created_at),
  CONSTRAINT fk_booking_payment_booking
    FOREIGN KEY (booking_id) REFERENCES bookings (bookingId) ON DELETE CASCADE,
  CONSTRAINT fk_booking_payment_quote
    FOREIGN KEY (quote_id) REFERENCES booking_quotes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

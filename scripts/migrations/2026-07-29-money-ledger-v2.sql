-- Production money ledger v2.
-- Additive by design: run the import/reconciliation script before setting MONEY_V2_ENABLED=true.

SET @aw365_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'withdrawal_accounts'
     AND column_name = 'recipient_code') = 0,
  'ALTER TABLE withdrawal_accounts ADD COLUMN recipient_code VARCHAR(255) DEFAULT NULL AFTER account_name',
  'SELECT 1'
);
PREPARE aw365_stmt FROM @aw365_sql;
EXECUTE aw365_stmt;
DEALLOCATE PREPARE aw365_stmt;

SET @aw365_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'withdrawal_accounts'
     AND column_name = 'created_at') = 0,
  'ALTER TABLE withdrawal_accounts ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
  'SELECT 1'
);
PREPARE aw365_stmt FROM @aw365_sql;
EXECUTE aw365_stmt;
DEALLOCATE PREPARE aw365_stmt;

SET @aw365_sql = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'withdrawal_accounts'
     AND column_name = 'updated_at') = 0,
  'ALTER TABLE withdrawal_accounts ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT 1'
);
PREPARE aw365_stmt FROM @aw365_sql;
EXECUTE aw365_stmt;
DEALLOCATE PREPARE aw365_stmt;

CREATE TABLE IF NOT EXISTS money_accounts (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_type      VARCHAR(30) NOT NULL,
  owner_id        VARCHAR(160) NOT NULL,
  purpose         VARCHAR(40) NOT NULL,
  currency        CHAR(3) NOT NULL DEFAULT 'NGN',
  balance_kobo    BIGINT NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_money_account (owner_type, owner_id, purpose, currency),
  INDEX idx_money_account_owner (owner_type, owner_id),
  CONSTRAINT chk_money_account_currency CHECK (currency = 'NGN')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS money_transactions (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference           VARCHAR(50) NOT NULL,
  idempotency_key     VARCHAR(160) DEFAULT NULL,
  transaction_type    VARCHAR(50) NOT NULL,
  status              VARCHAR(30) NOT NULL DEFAULT 'success',
  amount_kobo         BIGINT UNSIGNED NOT NULL,
  currency            CHAR(3) NOT NULL DEFAULT 'NGN',
  user_uid            VARCHAR(128) DEFAULT NULL,
  booking_id          INT DEFAULT NULL,
  external_reference  VARCHAR(255) DEFAULT NULL,
  metadata            JSON DEFAULT NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_money_transaction_reference (reference),
  UNIQUE KEY uq_money_transaction_idempotency (idempotency_key),
  INDEX idx_money_transaction_user (user_uid, created_at DESC),
  INDEX idx_money_transaction_booking (booking_id),
  INDEX idx_money_transaction_external (external_reference),
  CONSTRAINT chk_money_transaction_amount CHECK (amount_kobo > 0),
  CONSTRAINT chk_money_transaction_currency CHECK (currency = 'NGN')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS money_entries (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transaction_id  BIGINT UNSIGNED NOT NULL,
  account_id      BIGINT UNSIGNED NOT NULL,
  delta_kobo      BIGINT NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_money_entry_account (transaction_id, account_id),
  INDEX idx_money_entry_account_created (account_id, created_at DESC),
  CONSTRAINT fk_money_entry_transaction
    FOREIGN KEY (transaction_id) REFERENCES money_transactions(id),
  CONSTRAINT fk_money_entry_account
    FOREIGN KEY (account_id) REFERENCES money_accounts(id),
  CONSTRAINT chk_money_entry_nonzero CHECK (delta_kobo <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS funding_intents (
  id                        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference                 VARCHAR(50) NOT NULL,
  user_uid                  VARCHAR(128) NOT NULL,
  customer_email            VARCHAR(255) NOT NULL,
  amount_kobo               BIGINT UNSIGNED NOT NULL,
  currency                  CHAR(3) NOT NULL DEFAULT 'NGN',
  status                    VARCHAR(30) NOT NULL DEFAULT 'initialized',
  paystack_transaction_id   VARCHAR(80) DEFAULT NULL,
  channel                   VARCHAR(40) DEFAULT NULL,
  failure_reason            VARCHAR(500) DEFAULT NULL,
  paid_at                   DATETIME DEFAULT NULL,
  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_funding_intent_reference (reference),
  INDEX idx_funding_intent_user (user_uid, created_at DESC),
  INDEX idx_funding_intent_status (status, created_at),
  CONSTRAINT chk_funding_intent_amount CHECK (amount_kobo > 0),
  CONSTRAINT chk_funding_intent_currency CHECK (currency = 'NGN')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS booking_escrows_v2 (
  id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference               VARCHAR(50) NOT NULL,
  booking_id              INT NOT NULL,
  client_uid              VARCHAR(128) NOT NULL,
  artisan_uid             VARCHAR(128) NOT NULL,
  escrow_account_id       BIGINT UNSIGNED NOT NULL,
  amount_kobo             BIGINT UNSIGNED NOT NULL,
  platform_fee_kobo       BIGINT UNSIGNED NOT NULL DEFAULT 0,
  status                  VARCHAR(30) NOT NULL DEFAULT 'held',
  hold_transaction_id     BIGINT UNSIGNED NOT NULL,
  terminal_transaction_id BIGINT UNSIGNED DEFAULT NULL,
  created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at             DATETIME DEFAULT NULL,
  UNIQUE KEY uq_booking_escrow_booking (booking_id),
  UNIQUE KEY uq_booking_escrow_reference (reference),
  INDEX idx_booking_escrow_status (status, created_at),
  INDEX idx_booking_escrow_artisan (artisan_uid, status),
  CONSTRAINT fk_booking_escrow_account
    FOREIGN KEY (escrow_account_id) REFERENCES money_accounts(id),
  CONSTRAINT fk_booking_escrow_hold_transaction
    FOREIGN KEY (hold_transaction_id) REFERENCES money_transactions(id),
  CONSTRAINT fk_booking_escrow_terminal_transaction
    FOREIGN KEY (terminal_transaction_id) REFERENCES money_transactions(id),
  CONSTRAINT chk_booking_escrow_amount CHECK (amount_kobo > 0),
  CONSTRAINT chk_booking_escrow_fee CHECK (platform_fee_kobo >= 0 AND platform_fee_kobo < amount_kobo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS withdrawal_requests_v2 (
  id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference            VARCHAR(50) NOT NULL,
  user_uid             VARCHAR(128) NOT NULL,
  amount_kobo          BIGINT UNSIGNED NOT NULL,
  currency             CHAR(3) NOT NULL DEFAULT 'NGN',
  status               VARCHAR(30) NOT NULL DEFAULT 'reserved',
  reserved_account_id  BIGINT UNSIGNED NOT NULL,
  bank_name            VARCHAR(120) NOT NULL,
  bank_code            VARCHAR(20) NOT NULL,
  account_last4        CHAR(4) NOT NULL,
  account_name         VARCHAR(180) NOT NULL,
  recipient_code       VARCHAR(255) NOT NULL,
  transfer_code        VARCHAR(100) DEFAULT NULL,
  reserve_transaction_id BIGINT UNSIGNED NOT NULL,
  terminal_transaction_id BIGINT UNSIGNED DEFAULT NULL,
  attempt_count        INT UNSIGNED NOT NULL DEFAULT 0,
  failure_reason       VARCHAR(500) DEFAULT NULL,
  submitted_at         DATETIME DEFAULT NULL,
  completed_at         DATETIME DEFAULT NULL,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_withdrawal_v2_reference (reference),
  UNIQUE KEY uq_withdrawal_v2_reserve_transaction (reserve_transaction_id),
  INDEX idx_withdrawal_v2_user (user_uid, created_at DESC),
  INDEX idx_withdrawal_v2_status (status, updated_at),
  CONSTRAINT fk_withdrawal_v2_reserved_account
    FOREIGN KEY (reserved_account_id) REFERENCES money_accounts(id),
  CONSTRAINT fk_withdrawal_v2_reserve_transaction
    FOREIGN KEY (reserve_transaction_id) REFERENCES money_transactions(id),
  CONSTRAINT fk_withdrawal_v2_terminal_transaction
    FOREIGN KEY (terminal_transaction_id) REFERENCES money_transactions(id),
  CONSTRAINT chk_withdrawal_v2_amount CHECK (amount_kobo > 0),
  CONSTRAINT chk_withdrawal_v2_currency CHECK (currency = 'NGN')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_key      CHAR(64) NOT NULL,
  event_type     VARCHAR(80) NOT NULL,
  reference      VARCHAR(255) DEFAULT NULL,
  payload        JSON NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'received',
  attempt_count  INT UNSIGNED NOT NULL DEFAULT 0,
  last_error     VARCHAR(1000) DEFAULT NULL,
  received_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at   DATETIME DEFAULT NULL,
  UNIQUE KEY uq_payment_webhook_event (event_key),
  INDEX idx_payment_webhook_status (status, received_at),
  INDEX idx_payment_webhook_reference (reference)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS money_reconciliation_runs (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  status            VARCHAR(20) NOT NULL,
  imbalance_kobo    BIGINT NOT NULL DEFAULT 0,
  issue_count       INT UNSIGNED NOT NULL DEFAULT 0,
  details           JSON DEFAULT NULL,
  started_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at      DATETIME DEFAULT NULL,
  INDEX idx_money_reconciliation_started (started_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS money_rate_limits (
  rate_key          VARCHAR(190) PRIMARY KEY,
  request_count     INT UNSIGNED NOT NULL DEFAULT 0,
  window_started_at DATETIME(3) NOT NULL,
  updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX idx_money_rate_limit_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

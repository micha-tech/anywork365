-- Marketplace finance v3.
-- Additive follow-up to 2026-07-29-money-ledger-v2.sql.

CREATE TABLE IF NOT EXISTS money_account_policies (
  account_id       BIGINT UNSIGNED PRIMARY KEY,
  classification   VARCHAR(20) NOT NULL,
  allow_negative   TINYINT(1) NOT NULL DEFAULT 0,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_money_account_policy_account
    FOREIGN KEY (account_id) REFERENCES money_accounts(id),
  CONSTRAINT chk_money_account_classification
    CHECK (classification IN ('ASSET','LIABILITY','REVENUE','EXPENSE','EQUITY','CLEARING','SUSPENSE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS platform_fee_rules (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rule_code         VARCHAR(80) NOT NULL,
  version           INT UNSIGNED NOT NULL,
  fee_basis_points  INT UNSIGNED NOT NULL,
  minimum_fee_kobo  BIGINT UNSIGNED NOT NULL DEFAULT 0,
  maximum_fee_kobo  BIGINT UNSIGNED DEFAULT NULL,
  currency          CHAR(3) NOT NULL DEFAULT 'NGN',
  status            VARCHAR(20) NOT NULL DEFAULT 'active',
  effective_from    DATETIME NOT NULL,
  effective_until   DATETIME DEFAULT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_platform_fee_rule_version (rule_code, version),
  INDEX idx_platform_fee_rule_active (status, effective_from, effective_until),
  CONSTRAINT chk_platform_fee_rule_bps CHECK (fee_basis_points <= 10000),
  CONSTRAINT chk_platform_fee_rule_currency CHECK (currency = 'NGN')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO platform_fee_rules (
  rule_code, version, fee_basis_points, currency, status, effective_from
) VALUES ('marketplace-standard', 1, 500, 'NGN', 'active', NOW())
ON DUPLICATE KEY UPDATE id = id;

CREATE TABLE IF NOT EXISTS financial_idempotency_records (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  idempotency_key   VARCHAR(190) NOT NULL,
  operation         VARCHAR(80) NOT NULL,
  actor_id          VARCHAR(128) NOT NULL,
  request_hash      CHAR(64) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'processing',
  response_payload  JSON DEFAULT NULL,
  resource_type     VARCHAR(60) DEFAULT NULL,
  resource_id       VARCHAR(128) DEFAULT NULL,
  expires_at        DATETIME DEFAULT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_financial_idempotency_key (idempotency_key),
  INDEX idx_financial_idempotency_actor (actor_id, operation, created_at),
  INDEX idx_financial_idempotency_expiry (expires_at),
  CONSTRAINT chk_financial_idempotency_status
    CHECK (status IN ('processing','completed','failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS job_funds (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id            INT NOT NULL,
  client_uid            VARCHAR(128) NOT NULL,
  artisan_uid           VARCHAR(128) NOT NULL,
  currency              CHAR(3) NOT NULL DEFAULT 'NGN',
  expected_amount_kobo  BIGINT UNSIGNED NOT NULL,
  funded_amount_kobo    BIGINT UNSIGNED NOT NULL DEFAULT 0,
  locked_amount_kobo    BIGINT UNSIGNED NOT NULL DEFAULT 0,
  released_amount_kobo  BIGINT UNSIGNED NOT NULL DEFAULT 0,
  refunded_amount_kobo  BIGINT UNSIGNED NOT NULL DEFAULT 0,
  locked_account_id     BIGINT UNSIGNED NOT NULL,
  status                VARCHAR(30) NOT NULL DEFAULT 'awaiting_funding',
  funded_transaction_id BIGINT UNSIGNED DEFAULT NULL,
  release_transaction_id BIGINT UNSIGNED DEFAULT NULL,
  refund_transaction_id BIGINT UNSIGNED DEFAULT NULL,
  fee_rule_id           BIGINT UNSIGNED NOT NULL,
  platform_fee_kobo     BIGINT UNSIGNED NOT NULL DEFAULT 0,
  funded_at             DATETIME DEFAULT NULL,
  released_at           DATETIME DEFAULT NULL,
  cancelled_at          DATETIME DEFAULT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_job_funds_booking (booking_id),
  INDEX idx_job_funds_client (client_uid, status),
  INDEX idx_job_funds_artisan (artisan_uid, status),
  INDEX idx_job_funds_status (status, updated_at),
  CONSTRAINT fk_job_funds_booking FOREIGN KEY (booking_id) REFERENCES bookings(bookingId),
  CONSTRAINT fk_job_funds_locked_account FOREIGN KEY (locked_account_id) REFERENCES money_accounts(id),
  CONSTRAINT fk_job_funds_funded_transaction FOREIGN KEY (funded_transaction_id) REFERENCES money_transactions(id),
  CONSTRAINT fk_job_funds_release_transaction FOREIGN KEY (release_transaction_id) REFERENCES money_transactions(id),
  CONSTRAINT fk_job_funds_refund_transaction FOREIGN KEY (refund_transaction_id) REFERENCES money_transactions(id),
  CONSTRAINT fk_job_funds_fee_rule FOREIGN KEY (fee_rule_id) REFERENCES platform_fee_rules(id),
  CONSTRAINT chk_job_funds_amount CHECK (expected_amount_kobo > 0),
  CONSTRAINT chk_job_funds_currency CHECK (currency = 'NGN'),
  CONSTRAINT chk_job_funds_status CHECK (
    status IN ('awaiting_funding','funding_pending','cancel_requested','locked','released','refund_pending','refunded','disputed','cancelled')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS marketplace_payment_intents (
  id                       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  internal_reference       VARCHAR(50) NOT NULL,
  provider                 VARCHAR(30) NOT NULL DEFAULT 'paystack',
  provider_reference       VARCHAR(100) DEFAULT NULL,
  booking_id               INT NOT NULL,
  job_fund_id              BIGINT UNSIGNED NOT NULL,
  client_uid               VARCHAR(128) NOT NULL,
  customer_email           VARCHAR(255) NOT NULL,
  amount_kobo              BIGINT UNSIGNED NOT NULL,
  currency                 CHAR(3) NOT NULL DEFAULT 'NGN',
  payment_method           VARCHAR(40) DEFAULT NULL,
  status                   VARCHAR(30) NOT NULL DEFAULT 'created',
  purpose                  VARCHAR(40) NOT NULL DEFAULT 'booking_funding',
  provider_transaction_id  VARCHAR(80) DEFAULT NULL,
  failure_reason           VARCHAR(500) DEFAULT NULL,
  metadata                 JSON DEFAULT NULL,
  initialized_at           DATETIME DEFAULT NULL,
  confirmed_at             DATETIME DEFAULT NULL,
  failed_at                DATETIME DEFAULT NULL,
  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_marketplace_payment_internal_ref (internal_reference),
  UNIQUE KEY uq_marketplace_payment_provider_ref (provider, provider_reference),
  INDEX idx_marketplace_payment_booking (booking_id, status),
  INDEX idx_marketplace_payment_user (client_uid, created_at),
  INDEX idx_marketplace_payment_status (status, updated_at),
  CONSTRAINT fk_marketplace_payment_booking FOREIGN KEY (booking_id) REFERENCES bookings(bookingId),
  CONSTRAINT fk_marketplace_payment_job_fund FOREIGN KEY (job_fund_id) REFERENCES job_funds(id),
  CONSTRAINT chk_marketplace_payment_amount CHECK (amount_kobo > 0),
  CONSTRAINT chk_marketplace_payment_currency CHECK (currency = 'NGN'),
  CONSTRAINT chk_marketplace_payment_status CHECK (
    status IN ('created','initialized','pending','succeeded','failed','cancelled','refunded','partially_refunded','chargeback')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS provider_events (
  id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider             VARCHAR(30) NOT NULL,
  provider_event_id    VARCHAR(160) DEFAULT NULL,
  event_type           VARCHAR(80) NOT NULL,
  provider_reference   VARCHAR(160) DEFAULT NULL,
  payload              JSON NOT NULL,
  payload_hash         CHAR(64) NOT NULL,
  signature            VARCHAR(255) NOT NULL,
  signature_valid      TINYINT(1) NOT NULL,
  processing_status    VARCHAR(20) NOT NULL DEFAULT 'received',
  processing_attempts  INT UNSIGNED NOT NULL DEFAULT 0,
  processing_token     CHAR(36) DEFAULT NULL,
  processing_started_at DATETIME DEFAULT NULL,
  received_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at         DATETIME DEFAULT NULL,
  next_attempt_at      DATETIME DEFAULT NULL,
  last_error           VARCHAR(1000) DEFAULT NULL,
  UNIQUE KEY uq_provider_event_hash (provider, payload_hash),
  UNIQUE KEY uq_provider_event_id (provider, provider_event_id),
  INDEX idx_provider_event_work (processing_status, next_attempt_at, received_at),
  INDEX idx_provider_event_reference (provider, provider_reference),
  CONSTRAINT chk_provider_event_status CHECK (
    processing_status IN ('received','verified','processing','processed','ignored','failed','dead_letter')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS transfer_recipients (
  id                         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_uid                   VARCHAR(128) NOT NULL,
  provider                   VARCHAR(30) NOT NULL DEFAULT 'paystack',
  provider_recipient_code    VARCHAR(255) NOT NULL,
  bank_code                  VARCHAR(20) NOT NULL,
  bank_name                  VARCHAR(120) NOT NULL,
  account_number_last_four   CHAR(4) NOT NULL,
  account_name               VARCHAR(180) NOT NULL,
  verification_status        VARCHAR(30) NOT NULL DEFAULT 'verified',
  ownership_status           VARCHAR(30) NOT NULL DEFAULT 'matched',
  is_default                 TINYINT(1) NOT NULL DEFAULT 1,
  status                     VARCHAR(20) NOT NULL DEFAULT 'active',
  metadata                   JSON DEFAULT NULL,
  verified_at                DATETIME DEFAULT NULL,
  created_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_transfer_recipient_code (provider, provider_recipient_code),
  INDEX idx_transfer_recipient_user (user_uid, status, is_default),
  CONSTRAINT chk_transfer_recipient_status CHECK (status IN ('active','disabled')),
  CONSTRAINT chk_transfer_recipient_verification CHECK (
    verification_status IN ('pending','verified','failed')
  ),
  CONSTRAINT chk_transfer_recipient_ownership CHECK (
    ownership_status IN ('pending','matched','mismatch','manual_review')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS marketplace_withdrawal_requests (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  artisan_uid           VARCHAR(128) NOT NULL,
  recipient_id          BIGINT UNSIGNED NOT NULL,
  internal_reference    VARCHAR(50) NOT NULL,
  provider_reference    VARCHAR(160) DEFAULT NULL,
  amount_kobo           BIGINT UNSIGNED NOT NULL,
  fee_kobo              BIGINT UNSIGNED NOT NULL DEFAULT 0,
  net_amount_kobo       BIGINT UNSIGNED NOT NULL,
  currency              CHAR(3) NOT NULL DEFAULT 'NGN',
  status                VARCHAR(30) NOT NULL DEFAULT 'requested',
  risk_status           VARCHAR(30) NOT NULL DEFAULT 'pending',
  reserve_transaction_id BIGINT UNSIGNED NOT NULL,
  terminal_transaction_id BIGINT UNSIGNED DEFAULT NULL,
  submission_attempts   INT UNSIGNED NOT NULL DEFAULT 0,
  submission_token      CHAR(36) DEFAULT NULL,
  failure_reason        VARCHAR(500) DEFAULT NULL,
  requested_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at           DATETIME DEFAULT NULL,
  processing_at         DATETIME DEFAULT NULL,
  completed_at          DATETIME DEFAULT NULL,
  failed_at             DATETIME DEFAULT NULL,
  reversed_at           DATETIME DEFAULT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_marketplace_withdrawal_reference (internal_reference),
  UNIQUE KEY uq_marketplace_withdrawal_provider_ref (provider_reference),
  INDEX idx_marketplace_withdrawal_user (artisan_uid, created_at),
  INDEX idx_marketplace_withdrawal_work (status, risk_status, updated_at),
  CONSTRAINT fk_marketplace_withdrawal_recipient
    FOREIGN KEY (recipient_id) REFERENCES transfer_recipients(id),
  CONSTRAINT fk_marketplace_withdrawal_reserve_tx
    FOREIGN KEY (reserve_transaction_id) REFERENCES money_transactions(id),
  CONSTRAINT fk_marketplace_withdrawal_terminal_tx
    FOREIGN KEY (terminal_transaction_id) REFERENCES money_transactions(id),
  CONSTRAINT chk_marketplace_withdrawal_amount CHECK (amount_kobo > 0),
  CONSTRAINT chk_marketplace_withdrawal_net CHECK (net_amount_kobo > 0 AND net_amount_kobo <= amount_kobo),
  CONSTRAINT chk_marketplace_withdrawal_currency CHECK (currency = 'NGN'),
  CONSTRAINT chk_marketplace_withdrawal_status CHECK (
    status IN ('requested','under_review','approved','processing','success','failed','reversed','cancelled')
  ),
  CONSTRAINT chk_marketplace_withdrawal_risk CHECK (
    risk_status IN ('pending','passed','review','blocked')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS earnings_holds (
  id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_fund_id            BIGINT UNSIGNED NOT NULL,
  artisan_uid            VARCHAR(128) NOT NULL,
  pending_account_id     BIGINT UNSIGNED NOT NULL,
  available_account_id   BIGINT UNSIGNED NOT NULL,
  amount_kobo            BIGINT UNSIGNED NOT NULL,
  status                 VARCHAR(20) NOT NULL DEFAULT 'held',
  reason                 VARCHAR(255) NOT NULL,
  release_after          DATETIME NOT NULL,
  release_transaction_id BIGINT UNSIGNED DEFAULT NULL,
  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at            DATETIME DEFAULT NULL,
  UNIQUE KEY uq_earnings_hold_job_fund (job_fund_id),
  INDEX idx_earnings_hold_release (status, release_after),
  CONSTRAINT fk_earnings_hold_job_fund FOREIGN KEY (job_fund_id) REFERENCES job_funds(id),
  CONSTRAINT fk_earnings_hold_pending_account FOREIGN KEY (pending_account_id) REFERENCES money_accounts(id),
  CONSTRAINT fk_earnings_hold_available_account FOREIGN KEY (available_account_id) REFERENCES money_accounts(id),
  CONSTRAINT fk_earnings_hold_release_transaction FOREIGN KEY (release_transaction_id) REFERENCES money_transactions(id),
  CONSTRAINT chk_earnings_hold_amount CHECK (amount_kobo > 0),
  CONSTRAINT chk_earnings_hold_status CHECK (status IN ('held','released','reversed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS risk_holds (
  id                     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_uid               VARCHAR(128) NOT NULL,
  account_id             BIGINT UNSIGNED NOT NULL,
  amount_kobo            BIGINT UNSIGNED NOT NULL DEFAULT 0,
  reason_code            VARCHAR(80) NOT NULL,
  reason                 VARCHAR(500) NOT NULL,
  status                 VARCHAR(20) NOT NULL DEFAULT 'active',
  source_type            VARCHAR(60) DEFAULT NULL,
  source_id              VARCHAR(128) DEFAULT NULL,
  created_by_uid         VARCHAR(128) DEFAULT NULL,
  released_by_uid        VARCHAR(128) DEFAULT NULL,
  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at            DATETIME DEFAULT NULL,
  INDEX idx_risk_hold_user (user_uid, status),
  INDEX idx_risk_hold_source (source_type, source_id),
  CONSTRAINT fk_risk_hold_account FOREIGN KEY (account_id) REFERENCES money_accounts(id),
  CONSTRAINT chk_risk_hold_status CHECK (status IN ('active','released','consumed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS refund_requests (
  id                       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  internal_reference       VARCHAR(50) NOT NULL,
  job_fund_id              BIGINT UNSIGNED NOT NULL,
  requested_by_uid         VARCHAR(128) NOT NULL,
  amount_kobo              BIGINT UNSIGNED NOT NULL,
  currency                 CHAR(3) NOT NULL DEFAULT 'NGN',
  status                   VARCHAR(30) NOT NULL DEFAULT 'requested',
  reason                   VARCHAR(500) NOT NULL,
  ledger_transaction_id    BIGINT UNSIGNED DEFAULT NULL,
  provider_refund_reference VARCHAR(100) DEFAULT NULL,
  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at             DATETIME DEFAULT NULL,
  UNIQUE KEY uq_refund_request_reference (internal_reference),
  INDEX idx_refund_request_job (job_fund_id, status),
  CONSTRAINT fk_refund_request_job_fund FOREIGN KEY (job_fund_id) REFERENCES job_funds(id),
  CONSTRAINT fk_refund_request_transaction FOREIGN KEY (ledger_transaction_id) REFERENCES money_transactions(id),
  CONSTRAINT chk_refund_request_amount CHECK (amount_kobo > 0),
  CONSTRAINT chk_refund_request_currency CHECK (currency = 'NGN'),
  CONSTRAINT chk_refund_request_status CHECK (
    status IN ('requested','approved','processing','needs_attention','completed','failed','rejected')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS financial_disputes (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider              VARCHAR(30) NOT NULL DEFAULT 'paystack',
  provider_dispute_id   VARCHAR(160) DEFAULT NULL,
  payment_intent_id     BIGINT UNSIGNED DEFAULT NULL,
  job_fund_id           BIGINT UNSIGNED DEFAULT NULL,
  amount_kobo           BIGINT UNSIGNED NOT NULL,
  currency              CHAR(3) NOT NULL DEFAULT 'NGN',
  status                VARCHAR(30) NOT NULL DEFAULT 'open',
  reason                VARCHAR(500) DEFAULT NULL,
  evidence_due_at       DATETIME DEFAULT NULL,
  resolved_at           DATETIME DEFAULT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_financial_dispute_provider (provider, provider_dispute_id),
  INDEX idx_financial_dispute_status (status, created_at),
  CONSTRAINT fk_financial_dispute_payment
    FOREIGN KEY (payment_intent_id) REFERENCES marketplace_payment_intents(id),
  CONSTRAINT fk_financial_dispute_job
    FOREIGN KEY (job_fund_id) REFERENCES job_funds(id),
  CONSTRAINT chk_financial_dispute_status
    CHECK (status IN ('open','under_review','won','lost','closed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS financial_chargebacks (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dispute_id            BIGINT UNSIGNED NOT NULL,
  internal_reference    VARCHAR(50) NOT NULL,
  amount_kobo           BIGINT UNSIGNED NOT NULL,
  currency              CHAR(3) NOT NULL DEFAULT 'NGN',
  status                VARCHAR(30) NOT NULL DEFAULT 'recorded',
  ledger_transaction_id BIGINT UNSIGNED DEFAULT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_financial_chargeback_reference (internal_reference),
  UNIQUE KEY uq_financial_chargeback_dispute (dispute_id),
  CONSTRAINT fk_financial_chargeback_dispute
    FOREIGN KEY (dispute_id) REFERENCES financial_disputes(id),
  CONSTRAINT fk_financial_chargeback_transaction
    FOREIGN KEY (ledger_transaction_id) REFERENCES money_transactions(id),
  CONSTRAINT chk_financial_chargeback_status
    CHECK (status IN ('recorded','recovered','written_off','reversed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS financial_kyc_profiles (
  user_uid              VARCHAR(128) PRIMARY KEY,
  tier                  VARCHAR(30) NOT NULL DEFAULT 'basic',
  status                VARCHAR(30) NOT NULL DEFAULT 'pending',
  provider_reference    VARCHAR(160) DEFAULT NULL,
  verified_name         VARCHAR(180) DEFAULT NULL,
  verified_at           DATETIME DEFAULT NULL,
  metadata              JSON DEFAULT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_financial_kyc_status
    CHECK (status IN ('pending','verified','failed','manual_review','suspended'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS financial_notifications (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_uid              VARCHAR(128) NOT NULL,
  notification_type     VARCHAR(80) NOT NULL,
  aggregate_type        VARCHAR(60) NOT NULL,
  aggregate_id          VARCHAR(128) NOT NULL,
  payload               JSON NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'pending',
  sent_at               DATETIME DEFAULT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_financial_notification (user_uid, notification_type, aggregate_type, aggregate_id),
  INDEX idx_financial_notification_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS financial_admin_permissions (
  admin_uid             VARCHAR(128) NOT NULL,
  permission_code       VARCHAR(80) NOT NULL,
  granted_by_uid        VARCHAR(128) NOT NULL,
  reason                VARCHAR(500) NOT NULL,
  expires_at            DATETIME DEFAULT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at            DATETIME DEFAULT NULL,
  PRIMARY KEY (admin_uid, permission_code),
  INDEX idx_financial_permission_active (permission_code, revoked_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS financial_adjustments (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  internal_reference    VARCHAR(50) NOT NULL,
  target_user_uid       VARCHAR(128) NOT NULL,
  target_account_type   VARCHAR(40) NOT NULL,
  direction             VARCHAR(10) NOT NULL,
  amount_kobo           BIGINT UNSIGNED NOT NULL,
  currency              CHAR(3) NOT NULL DEFAULT 'NGN',
  reason                VARCHAR(500) NOT NULL,
  ticket_reference      VARCHAR(160) NOT NULL,
  ledger_transaction_id BIGINT UNSIGNED NOT NULL,
  created_by_uid        VARCHAR(128) NOT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_financial_adjustment_reference (internal_reference),
  UNIQUE KEY uq_financial_adjustment_transaction (ledger_transaction_id),
  CONSTRAINT fk_financial_adjustment_transaction
    FOREIGN KEY (ledger_transaction_id) REFERENCES money_transactions(id),
  CONSTRAINT chk_financial_adjustment_direction CHECK (direction IN ('credit','debit')),
  CONSTRAINT chk_financial_adjustment_amount CHECK (amount_kobo > 0),
  CONSTRAINT chk_financial_adjustment_currency CHECK (currency = 'NGN')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS financial_audit_logs (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_type          VARCHAR(30) NOT NULL,
  actor_id            VARCHAR(128) NOT NULL,
  action              VARCHAR(100) NOT NULL,
  resource_type       VARCHAR(60) NOT NULL,
  resource_id         VARCHAR(128) NOT NULL,
  internal_reference  VARCHAR(160) DEFAULT NULL,
  reason              VARCHAR(500) DEFAULT NULL,
  details             JSON DEFAULT NULL,
  request_id          VARCHAR(80) DEFAULT NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_financial_audit_actor (actor_id, created_at),
  INDEX idx_financial_audit_resource (resource_type, resource_id),
  INDEX idx_financial_audit_reference (internal_reference)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS financial_outbox_events (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_key             VARCHAR(190) NOT NULL,
  event_type            VARCHAR(80) NOT NULL,
  aggregate_type        VARCHAR(60) NOT NULL,
  aggregate_id          VARCHAR(128) NOT NULL,
  payload               JSON NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempt_count         INT UNSIGNED NOT NULL DEFAULT 0,
  available_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processing_token      CHAR(36) DEFAULT NULL,
  processing_started_at DATETIME DEFAULT NULL,
  delivered_at          DATETIME DEFAULT NULL,
  last_error            VARCHAR(1000) DEFAULT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_financial_outbox_event (event_key),
  INDEX idx_financial_outbox_delivery (status, available_at),
  CONSTRAINT chk_financial_outbox_status CHECK (
    status IN ('pending','processing','delivered','failed','dead_letter')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS reconciliation_items (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reconciliation_run_id BIGINT UNSIGNED NOT NULL,
  mismatch_type         VARCHAR(60) NOT NULL,
  severity              VARCHAR(20) NOT NULL DEFAULT 'error',
  internal_reference    VARCHAR(160) DEFAULT NULL,
  provider_reference    VARCHAR(160) DEFAULT NULL,
  user_uid              VARCHAR(128) DEFAULT NULL,
  booking_id            INT DEFAULT NULL,
  withdrawal_id         BIGINT UNSIGNED DEFAULT NULL,
  expected_amount_kobo  BIGINT DEFAULT NULL,
  actual_amount_kobo    BIGINT DEFAULT NULL,
  expected_status       VARCHAR(40) DEFAULT NULL,
  actual_status         VARCHAR(40) DEFAULT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'open',
  resolution            VARCHAR(500) DEFAULT NULL,
  resolved_by_uid       VARCHAR(128) DEFAULT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at           DATETIME DEFAULT NULL,
  INDEX idx_reconciliation_item_run (reconciliation_run_id, status),
  INDEX idx_reconciliation_item_reference (internal_reference, provider_reference),
  CONSTRAINT fk_reconciliation_item_run
    FOREIGN KEY (reconciliation_run_id) REFERENCES money_reconciliation_runs(id),
  CONSTRAINT chk_reconciliation_item_status CHECK (status IN ('open','resolved','accepted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS wallet_limits (
  id                       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  policy_code              VARCHAR(80) NOT NULL,
  currency                 CHAR(3) NOT NULL DEFAULT 'NGN',
  minimum_withdrawal_kobo  BIGINT UNSIGNED NOT NULL,
  maximum_withdrawal_kobo  BIGINT UNSIGNED NOT NULL,
  daily_withdrawal_kobo    BIGINT UNSIGNED NOT NULL,
  monthly_withdrawal_kobo  BIGINT UNSIGNED NOT NULL,
  automatic_withdrawal_kobo BIGINT UNSIGNED NOT NULL,
  earnings_hold_hours      INT UNSIGNED NOT NULL,
  bank_change_hold_hours   INT UNSIGNED NOT NULL,
  status                   VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wallet_limits_policy (policy_code),
  CONSTRAINT chk_wallet_limits_currency CHECK (currency = 'NGN')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO wallet_limits (
  policy_code, currency, minimum_withdrawal_kobo, maximum_withdrawal_kobo,
  daily_withdrawal_kobo, monthly_withdrawal_kobo, automatic_withdrawal_kobo,
  earnings_hold_hours, bank_change_hold_hours
) VALUES (
  'default', 'NGN', 50000, 500000000, 100000000, 500000000, 20000000, 72, 24
)
ON DUPLICATE KEY UPDATE policy_code = policy_code;

CREATE OR REPLACE VIEW ledger_entries_view AS
SELECT
  me.id,
  me.transaction_id AS ledger_transaction_id,
  me.account_id AS ledger_account_id,
  CASE WHEN me.delta_kobo > 0 THEN 'CREDIT' ELSE 'DEBIT' END AS direction,
  ABS(me.delta_kobo) AS amount_minor,
  ma.currency,
  me.created_at
FROM money_entries me
JOIN money_accounts ma ON ma.id = me.account_id;

DROP TRIGGER IF EXISTS prevent_money_entry_update;
CREATE TRIGGER prevent_money_entry_update
BEFORE UPDATE ON money_entries
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Posted ledger entries are immutable';

DROP TRIGGER IF EXISTS prevent_money_entry_delete;
CREATE TRIGGER prevent_money_entry_delete
BEFORE DELETE ON money_entries
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Posted ledger entries are immutable';

DROP TRIGGER IF EXISTS prevent_money_transaction_update;
CREATE TRIGGER prevent_money_transaction_update
BEFORE UPDATE ON money_transactions
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Posted ledger transactions are immutable';

DROP TRIGGER IF EXISTS prevent_money_transaction_delete;
CREATE TRIGGER prevent_money_transaction_delete
BEFORE DELETE ON money_transactions
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Posted ledger transactions are immutable';

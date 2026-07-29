-- Verified client wallet funding and receipts.
-- Requires the marketplace finance v3 schema.

CREATE TABLE IF NOT EXISTS wallet_funding_intents (
  id                       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  internal_reference       VARCHAR(50) NOT NULL,
  provider                 VARCHAR(30) NOT NULL DEFAULT 'paystack',
  provider_reference       VARCHAR(100) DEFAULT NULL,
  client_uid               VARCHAR(128) NOT NULL,
  customer_email           VARCHAR(255) NOT NULL,
  requested_amount_kobo    BIGINT UNSIGNED NOT NULL,
  charged_amount_kobo      BIGINT UNSIGNED DEFAULT NULL,
  credited_amount_kobo     BIGINT UNSIGNED DEFAULT NULL,
  provider_fee_kobo        BIGINT UNSIGNED NOT NULL DEFAULT 0,
  currency                 CHAR(3) NOT NULL DEFAULT 'NGN',
  payment_method           VARCHAR(40) DEFAULT NULL,
  status                   VARCHAR(30) NOT NULL DEFAULT 'created',
  provider_transaction_id  VARCHAR(80) DEFAULT NULL,
  ledger_transaction_id    BIGINT UNSIGNED DEFAULT NULL,
  receipt_number           VARCHAR(50) DEFAULT NULL,
  failure_reason           VARCHAR(500) DEFAULT NULL,
  metadata                 JSON DEFAULT NULL,
  initialized_at           DATETIME DEFAULT NULL,
  paid_at                  DATETIME DEFAULT NULL,
  confirmed_at             DATETIME DEFAULT NULL,
  failed_at                DATETIME DEFAULT NULL,
  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wallet_funding_internal_ref (internal_reference),
  UNIQUE KEY uq_wallet_funding_provider_ref (provider, provider_reference),
  UNIQUE KEY uq_wallet_funding_provider_tx (provider, provider_transaction_id),
  UNIQUE KEY uq_wallet_funding_receipt (receipt_number),
  UNIQUE KEY uq_wallet_funding_ledger_tx (ledger_transaction_id),
  INDEX idx_wallet_funding_client (client_uid, created_at),
  INDEX idx_wallet_funding_status (status, updated_at),
  CONSTRAINT fk_wallet_funding_ledger_tx
    FOREIGN KEY (ledger_transaction_id) REFERENCES money_transactions(id),
  CONSTRAINT chk_wallet_funding_requested CHECK (requested_amount_kobo > 0),
  CONSTRAINT chk_wallet_funding_charged
    CHECK (charged_amount_kobo IS NULL OR charged_amount_kobo >= requested_amount_kobo),
  CONSTRAINT chk_wallet_funding_credited
    CHECK (credited_amount_kobo IS NULL OR credited_amount_kobo = requested_amount_kobo),
  CONSTRAINT chk_wallet_funding_currency CHECK (currency = 'NGN'),
  CONSTRAINT chk_wallet_funding_status CHECK (
    status IN ('created','initialized','pending','succeeded','failed','cancelled','refunded','chargeback')
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


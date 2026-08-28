-- Payment integrity v5.
-- Makes the quote -> job fund -> payment intent -> transfer account chain
-- database-enforced while retaining pre-quote job funds as auditable legacy rows.

ALTER TABLE booking_quotes
  MODIFY COLUMN artisan_uid VARCHAR(128)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  ADD UNIQUE KEY uq_booking_quote_relational (id, booking_id, artisan_uid);

ALTER TABLE job_funds
  ADD COLUMN quote_id BIGINT UNSIGNED DEFAULT NULL AFTER booking_id,
  ADD COLUMN initiated_request_id CHAR(36) DEFAULT NULL AFTER platform_fee_kobo,
  ADD COLUMN initiated_session_fingerprint CHAR(64) DEFAULT NULL AFTER initiated_request_id;

ALTER TABLE marketplace_payment_intents
  ADD COLUMN quote_id BIGINT UNSIGNED DEFAULT NULL AFTER booking_id,
  ADD COLUMN initiated_request_id CHAR(36) DEFAULT NULL AFTER purpose,
  ADD COLUMN initiated_session_fingerprint CHAR(64) DEFAULT NULL AFTER initiated_request_id;

UPDATE job_funds jf
JOIN (
  SELECT booking_id, MAX(id) AS quote_id
  FROM booking_quotes
  WHERE status = 'accepted'
  GROUP BY booking_id
) accepted ON accepted.booking_id = jf.booking_id
SET jf.quote_id = accepted.quote_id
WHERE jf.quote_id IS NULL;

UPDATE marketplace_payment_intents mpi
JOIN (
  SELECT booking_id, MAX(id) AS quote_id
  FROM booking_quotes
  WHERE status = 'accepted'
  GROUP BY booking_id
) accepted ON accepted.booking_id = mpi.booking_id
SET mpi.quote_id = accepted.quote_id
WHERE mpi.quote_id IS NULL;

UPDATE marketplace_payment_intents
SET initiated_request_id = COALESCE(initiated_request_id, UUID()),
    initiated_session_fingerprint = COALESCE(
      initiated_session_fingerprint,
      REPEAT('0', 64)
    );

-- Keep the migration safe to apply before the matching application release.
-- The currently deployed release does not yet supply these context columns, so
-- derive them during the short deployment window. New releases supply all three
-- values explicitly and COALESCE preserves those values unchanged.
DROP TRIGGER IF EXISTS fill_job_fund_payment_context;
CREATE TRIGGER fill_job_fund_payment_context
BEFORE INSERT ON job_funds
FOR EACH ROW
SET NEW.quote_id = COALESCE(
      NEW.quote_id,
      (
        SELECT MAX(q.id)
        FROM booking_quotes q
        WHERE q.booking_id = NEW.booking_id AND q.status = 'accepted'
      )
    ),
    NEW.initiated_request_id = COALESCE(NEW.initiated_request_id, UUID()),
    NEW.initiated_session_fingerprint = COALESCE(
      NEW.initiated_session_fingerprint,
      REPEAT('0', 64)
    );

DROP TRIGGER IF EXISTS fill_payment_intent_context;
CREATE TRIGGER fill_payment_intent_context
BEFORE INSERT ON marketplace_payment_intents
FOR EACH ROW
SET NEW.quote_id = COALESCE(
      NEW.quote_id,
      (
        SELECT MAX(q.id)
        FROM booking_quotes q
        WHERE q.booking_id = NEW.booking_id AND q.status = 'accepted'
      )
    ),
    NEW.initiated_request_id = COALESCE(NEW.initiated_request_id, UUID()),
    NEW.initiated_session_fingerprint = COALESCE(
      NEW.initiated_session_fingerprint,
      REPEAT('0', 64)
    );

ALTER TABLE job_funds
  ADD UNIQUE KEY uq_job_fund_payment_link (
    id, booking_id, quote_id, client_uid, expected_amount_kobo, currency
  ),
  ADD CONSTRAINT fk_job_fund_quote_link
    FOREIGN KEY (quote_id, booking_id, artisan_uid)
    REFERENCES booking_quotes (id, booking_id, artisan_uid)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE marketplace_payment_intents
  MODIFY COLUMN quote_id BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN initiated_request_id CHAR(36) NOT NULL,
  MODIFY COLUMN initiated_session_fingerprint CHAR(64) NOT NULL,
  ADD UNIQUE KEY uq_marketplace_payment_provider_tx (
    provider, provider_transaction_id
  ),
  ADD UNIQUE KEY uq_marketplace_payment_link (
    id, booking_id, quote_id, client_uid, amount_kobo, currency
  ),
  ADD CONSTRAINT fk_marketplace_payment_job_link
    FOREIGN KEY (
      job_fund_id, booking_id, quote_id, client_uid, amount_kobo, currency
    ) REFERENCES job_funds (
      id, booking_id, quote_id, client_uid, expected_amount_kobo, currency
    ) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE booking_payment_accounts
  MODIFY COLUMN marketplace_payment_intent_id BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN client_uid VARCHAR(128)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  MODIFY COLUMN currency CHAR(3)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'NGN';

ALTER TABLE booking_payment_accounts
  ADD COLUMN active_booking_id INT
    GENERATED ALWAYS AS (
      CASE WHEN status = 'active' THEN booking_id ELSE NULL END
    ) VIRTUAL;

ALTER TABLE booking_payment_accounts
  ADD UNIQUE KEY uq_booking_payment_intent (marketplace_payment_intent_id);

ALTER TABLE booking_payment_accounts
  ADD UNIQUE KEY uq_booking_payment_one_active (active_booking_id);

ALTER TABLE booking_payment_accounts
  ADD CONSTRAINT fk_booking_payment_intent_link
    FOREIGN KEY (
      marketplace_payment_intent_id, booking_id, quote_id,
      client_uid, amount_kobo, currency
    ) REFERENCES marketplace_payment_intents (
      id, booking_id, quote_id, client_uid, amount_kobo, currency
    ) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE booking_payment_accounts
  DROP FOREIGN KEY fk_booking_payment_quote,
  ADD CONSTRAINT fk_booking_payment_quote
    FOREIGN KEY (quote_id) REFERENCES booking_quotes (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Quote-defined full or two-stage payments.
-- A booking may have one funding record per instalment; every instalment remains
-- linked to the accepted quote, client, artisan and booking by the v5 FKs.

ALTER TABLE booking_quotes
  ADD COLUMN payment_option ENUM('full', 'part') NOT NULL DEFAULT 'full' AFTER amount,
  ADD COLUMN upfront_amount DECIMAL(15,2) DEFAULT NULL AFTER payment_option;

UPDATE booking_quotes
SET upfront_amount = amount
WHERE upfront_amount IS NULL;

ALTER TABLE booking_quotes
  MODIFY COLUMN upfront_amount DECIMAL(15,2) NOT NULL;

ALTER TABLE job_funds
  DROP INDEX uq_job_funds_booking,
  ADD COLUMN installment_no TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER quote_id,
  ADD UNIQUE KEY uq_job_funds_booking_installment (booking_id, installment_no),
  ADD CONSTRAINT chk_job_funds_installment CHECK (installment_no IN (1, 2));


-- Migration: Add recipient_code to withdrawal_accounts for Paystack transfers
-- Run: node scripts/run-migration.mjs scripts/migration-20260529-withdrawal-recipient-code.sql

ALTER TABLE withdrawal_accounts ADD COLUMN recipient_code VARCHAR(255) DEFAULT NULL AFTER account_name;

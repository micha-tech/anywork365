-- Standardize every remaining table to utf8mb4_general_ci.
--
-- Why:
--   * 27 legacy tables are still latin1_swedish_ci. mysql2 sends parameters as
--     utf8mb4_unicode_ci, so non-ASCII input (₦, en-dashes, emojis) raises
--     ER_IMPOSSIBLE_STRING_CONVERSION (errno 3988) on INSERT/UPDATE.
--   * transactions, wallets and withdrawal_accounts are utf8mb4_unicode_ci,
--     which clashes with utf8mb4_general_ci columns in joins
--     (ER_CANT_AGGREGATE_2COLLATIONS, errno 1267).
--   * Newer tables defaulted to utf8mb4_0900_ai_ci; a single uniform
--     collation removes every mixed-collation join failure.
--
-- utf8mb4_general_ci is the DB-wide convention (users.uid and the financial /
-- wallet /*_uid columns were already utf8mb4_general_ci).
--
-- All 44 tables are InnoDB ROW_FORMAT=DYNAMIC and had their index key lengths
-- audited; every index stays well below the 3072-byte utf8mb4 limit.
--
-- Two tables need session relaxations so the rebuild can succeed:
-- business_ratings has no PRIMARY KEY (sql_require_primary_key blocks it) and
-- businesses contains one legacy '0000-00-00 00:00:00' timestamp
-- (NO_ZERO_DATE blocks it). The overrides are session-scoped only.

SET SESSION sql_require_primary_key = OFF;
SET SESSION sql_mode = REGEXP_REPLACE(REGEXP_REPLACE(@@sql_mode, 'NO_ZERO_(IN_)?DATE', ''), ',+', ',');

-- Latin-1 legacy tables
ALTER TABLE _backup_vacancy_applications_pre_20260722 CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE admin_notifications CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE admins CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE adverts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE app_features CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE business_images CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE business_ratings CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE businesses CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE categories CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE companies CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE delete_account_request CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE favorites CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE reviews CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE services CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE subscription_categories CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE subscription_plans CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE subscriptions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE suspended_users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE suspended_vendors CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE training_applications CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE trainings CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE user_profile CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE users_notifications CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE vacancies CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE vacancy_applications CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE verified_businesses CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE withdrawals CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- Legacy utf8mb4_unicode_ci tables
ALTER TABLE transactions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE wallets CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE withdrawal_accounts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- Tables that defaulted to utf8mb4_0900_ai_ci
ALTER TABLE _migrations CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE admin_audit_log CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE artisan_live_locations CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE booking_payment_accounts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE booking_quotes CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE business_verifications CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE chat_conversations CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE chat_messages CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE disputes CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE financial_schema_migrations CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE professional_profiles CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE recruiter_profiles CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE user_fcm_tokens CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
ALTER TABLE user_portfolio CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- bookings was converted separately (2026-09-24-bookings-utf8mb4.sql) using
-- the same utf8mb4_general_ci collation.
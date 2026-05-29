-- Migration: Add idempotency constraints for wallet operations
-- Run: mysql -h $MYSQL_HOST -u $MYSQL_USER -p $MYSQL_DATABASE < scripts/migration-20260526-idempotency.sql

ALTER TABLE wallet_transactions ADD UNIQUE INDEX uq_wallet_transactions_reference (reference);

ALTER TABLE withdrawals ADD INDEX idx_withdrawals_user_amount_status (user_id, amount, status);

ALTER TABLE users_notifications ADD INDEX idx_notif_unread (recieverUid, seenByReciever);

ALTER TABLE withdrawals ADD INDEX idx_withdrawals_user_created (user_id, created_at DESC);

ALTER TABLE vacancy_applications ADD INDEX idx_applications_uid_date (uid, applied_date DESC);

ALTER TABLE business_verifications ADD INDEX idx_biz_ver_status (status);

ALTER TABLE users ADD INDEX idx_users_suspended (suspended);

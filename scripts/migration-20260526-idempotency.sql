-- Migration: Add idempotency constraints for wallet operations
-- Run: mysql -h $MYSQL_HOST -u $MYSQL_USER -p $MYSQL_DATABASE < scripts/migration-20260526-idempotency.sql

ALTER TABLE wallet_transactions ADD UNIQUE INDEX uq_wallet_transactions_reference (reference);

ALTER TABLE withdrawals ADD INDEX idx_withdrawals_user_amount_status (user_id, amount, status);

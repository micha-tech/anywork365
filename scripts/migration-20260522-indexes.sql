-- Migration: Add missing indexes for performance
-- Run: mysql -h $MYSQL_HOST -u $MYSQL_USER -p $MYSQL_DATABASE < scripts/migration-20260522-indexes.sql

ALTER TABLE bookings ADD INDEX idx_bookings_client_status (clientUID, bookingStatus) IF NOT EXISTS;
ALTER TABLE businesses ADD FULLTEXT INDEX ft_businesses_search (businessName, description, category) IF NOT EXISTS;
ALTER TABLE wallet_ledger ADD INDEX idx_wallet_ledger_balance (wallet_id, direction, amount) IF NOT EXISTS;

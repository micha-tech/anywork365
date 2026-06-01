-- Migration: Make NIN optional for business verification
-- Run: mysql -h $MYSQL_HOST -u $MYSQL_USER -p $MYSQL_DATABASE < scripts/migration-20260601-optional-nin.sql

ALTER TABLE business_verifications MODIFY COLUMN nin VARCHAR(11) DEFAULT NULL;

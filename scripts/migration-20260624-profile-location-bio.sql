-- Run: node scripts/run-migration.mjs scripts/migration-20260624-profile-location-bio.sql

ALTER TABLE users ADD COLUMN bio TEXT NULL AFTER address;
ALTER TABLE users MODIFY COLUMN lga VARCHAR(100) DEFAULT NULL;
ALTER TABLE users MODIFY COLUMN address VARCHAR(500) DEFAULT '';

SET SESSION sql_mode = 'ALLOW_INVALID_DATES,NO_ENGINE_SUBSTITUTION';

ALTER TABLE businesses
  MODIFY COLUMN dateSubscribed DATE NULL DEFAULT NULL,
  MODIFY COLUMN expiryDate DATE NULL DEFAULT NULL,
  MODIFY COLUMN lga VARCHAR(100) DEFAULT NULL,
  MODIFY COLUMN location VARCHAR(500) DEFAULT '';

UPDATE businesses
SET dateSubscribed = NULL
WHERE dateSubscribed = '0000-00-00';

UPDATE businesses
SET expiryDate = NULL
WHERE expiryDate = '0000-00-00';

UPDATE users u
JOIN businesses b ON b.uid = u.uid AND b.deleted = 0
SET u.bio = COALESCE(NULLIF(u.bio, ''), b.description),
    u.lga = COALESCE(NULLIF(u.lga, ''), b.lga),
    u.address = COALESCE(NULLIF(u.address, ''), b.location)
WHERE u.hasBusinessAccount = 1;

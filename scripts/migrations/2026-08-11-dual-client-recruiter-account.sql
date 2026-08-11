ALTER TABLE users
  ADD COLUMN can_switch_client_recruiter TINYINT(1) NOT NULL DEFAULT 0 AFTER role;

UPDATE users
SET can_switch_client_recruiter = 1
WHERE LOWER(email) = 'vethanconcepts@gmail.com'
  AND deleted = 0;

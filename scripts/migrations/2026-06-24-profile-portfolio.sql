ALTER TABLE users ADD COLUMN bio TEXT NULL AFTER address;

UPDATE users u
JOIN businesses b ON b.uid = u.uid AND b.deleted = 0
SET u.bio = COALESCE(NULLIF(u.bio, ''), b.description),
    u.lga = COALESCE(NULLIF(u.lga, ''), b.lga),
    u.address = COALESCE(NULLIF(u.address, ''), b.location)
WHERE u.hasBusinessAccount = 1;

CREATE TABLE IF NOT EXISTS user_portfolio (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  uid         VARCHAR(128) NOT NULL,
  title       VARCHAR(120) NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  imageUrl    VARCHAR(1000) NOT NULL,
  createdAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_portfolio_uid_created (uid, createdAt DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

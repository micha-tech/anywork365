CREATE TABLE IF NOT EXISTS user_portfolio (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  uid         VARCHAR(128) NOT NULL,
  title       VARCHAR(120) NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  imageUrl    VARCHAR(1000) NOT NULL,
  createdAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_portfolio_uid_created (uid, createdAt DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

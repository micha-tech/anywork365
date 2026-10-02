CREATE TABLE IF NOT EXISTS broadcast_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  admin_uid VARCHAR(128) NOT NULL,
  title VARCHAR(120) NOT NULL,
  body VARCHAR(1000) NOT NULL,
  image_url VARCHAR(2048) NULL,
  action_url VARCHAR(1024) NULL,
  status ENUM('queued', 'sending', 'completed', 'failed') NOT NULL DEFAULT 'queued',
  token_cursor BIGINT UNSIGNED NOT NULL DEFAULT 0,
  delivered_count INT UNSIGNED NOT NULL DEFAULT 0,
  failed_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_error VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  INDEX idx_broadcast_notifications_status (status, id),
  INDEX idx_broadcast_notifications_admin (admin_uid, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

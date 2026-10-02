ALTER TABLE broadcast_notifications
  ADD COLUMN audience_type ENUM('all', 'selected') NOT NULL DEFAULT 'all' AFTER action_url;

CREATE TABLE IF NOT EXISTS broadcast_notification_recipients (
  campaign_id BIGINT UNSIGNED NOT NULL,
  uid VARCHAR(128) NOT NULL,
  PRIMARY KEY (campaign_id, uid),
  INDEX idx_broadcast_notification_recipients_uid (uid),
  CONSTRAINT fk_broadcast_notification_recipients_campaign
    FOREIGN KEY (campaign_id) REFERENCES broadcast_notifications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE bookings
  ADD COLUMN inspectionMethod ENUM('none', 'physical', 'virtual') NOT NULL DEFAULT 'none'
  AFTER meetingPoint;

CREATE TABLE IF NOT EXISTS booking_quotes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id INT NOT NULL,
  artisan_uid VARCHAR(128) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  scope TEXT NOT NULL,
  estimated_duration VARCHAR(120) DEFAULT NULL,
  proposed_start_date DATE DEFAULT NULL,
  status ENUM('pending', 'accepted', 'rejected', 'superseded', 'withdrawn') NOT NULL DEFAULT 'pending',
  responded_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_booking_quotes_booking_created (booking_id, created_at),
  INDEX idx_booking_quotes_artisan_status (artisan_uid, status),
  CONSTRAINT fk_booking_quotes_booking
    FOREIGN KEY (booking_id) REFERENCES bookings (bookingId) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

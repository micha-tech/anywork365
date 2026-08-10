CREATE TABLE IF NOT EXISTS artisan_live_locations (
  uid             VARCHAR(128) NOT NULL PRIMARY KEY,
  latitude        DECIMAL(10,7) NOT NULL,
  longitude       DECIMAL(10,7) NOT NULL,
  accuracy_meters DECIMAL(10,2) DEFAULT NULL,
  location_label  VARCHAR(220) NOT NULL DEFAULT '',
  sharing_enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_artisan_live_locations_active (sharing_enabled, updated_at),
  INDEX idx_artisan_live_locations_coordinates (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

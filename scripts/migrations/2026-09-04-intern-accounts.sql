-- Add Intern accounts and persist their undergraduate/graduate track.
ALTER TABLE users
  MODIFY COLUMN role ENUM('client','artisan','professional','recruiter','intern','support','admin') DEFAULT NULL;

CREATE TABLE IF NOT EXISTS intern_profiles (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  uid                  VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL UNIQUE,
  intern_type          ENUM('undergraduate','graduate') NOT NULL,
  school_name         VARCHAR(220) DEFAULT NULL,
  field_of_study      VARCHAR(180) DEFAULT NULL,
  graduation_year     SMALLINT UNSIGNED DEFAULT NULL,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_intern_type (intern_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE users
  MODIFY COLUMN role ENUM('client','vendor','artisan','professional','recruiter','intern','admin') DEFAULT NULL;

UPDATE users
SET role = 'artisan'
WHERE role = 'vendor' OR (role IS NULL AND hasBusinessAccount = 1);

ALTER TABLE users
  MODIFY COLUMN role ENUM('client','artisan','professional','recruiter','intern','admin') DEFAULT NULL;

CREATE TABLE IF NOT EXISTS professional_profiles (
  id                            INT AUTO_INCREMENT PRIMARY KEY,
  uid                           VARCHAR(128) NOT NULL UNIQUE,
  industry_category             VARCHAR(120) NOT NULL,
  professional_service_category VARCHAR(160) NOT NULL,
  job_title                     VARCHAR(160) NOT NULL,
  qualification                 VARCHAR(120) NOT NULL,
  years_experience              SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  linkedin_or_portfolio_url     VARCHAR(500) DEFAULT NULL,
  created_at                    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at                    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_professional_industry (industry_category),
  INDEX idx_professional_service (professional_service_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS recruiter_profiles (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  uid                  VARCHAR(128) NOT NULL UNIQUE,
  company_name         VARCHAR(180) NOT NULL,
  company_size         VARCHAR(50) NOT NULL,
  industry_category    VARCHAR(120) NOT NULL,
  recruitment_function VARCHAR(160) NOT NULL,
  position             VARCHAR(160) NOT NULL,
  company_website      VARCHAR(500) DEFAULT NULL,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_recruiter_industry (industry_category),
  INDEX idx_recruiter_function (recruitment_function)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

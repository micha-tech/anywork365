-- AnyWork365 Full Schema
-- Run: mysql -h $MYSQL_HOST -u $MYSQL_USER -p $MYSQL_DATABASE < scripts/schema.sql

CREATE TABLE IF NOT EXISTS users (
  userId          INT AUTO_INCREMENT PRIMARY KEY,
  uid             VARCHAR(128) NOT NULL UNIQUE,
  email           VARCHAR(255) NOT NULL,
  fullName        VARCHAR(255) NOT NULL DEFAULT '',
  phoneNumber     VARCHAR(50) NOT NULL DEFAULT '',
  state           VARCHAR(100) NOT NULL DEFAULT '',
  lga             VARCHAR(100) DEFAULT NULL,
  gender          VARCHAR(20) NOT NULL DEFAULT '',
  profileImage    VARCHAR(500) NOT NULL DEFAULT '',
  nin             VARCHAR(20) DEFAULT NULL,
  address         VARCHAR(500) NOT NULL DEFAULT '',
  googleAddress   VARCHAR(500) NOT NULL DEFAULT '',
  hasBusinessAccount TINYINT(1) NOT NULL DEFAULT 0,
  role            ENUM('client','vendor','admin') DEFAULT NULL,
  verified        TINYINT(1) NOT NULL DEFAULT 0,
  suspended       TINYINT(1) NOT NULL DEFAULT 0,
  businessUuid    VARCHAR(128) DEFAULT NULL,
  loginProvider   VARCHAR(50) NOT NULL DEFAULT 'EmailAndPassword',
  dateJoined      DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted         TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_users_email (email),
  INDEX idx_users_role_deleted (role, deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS businesses (
  businessId        INT AUTO_INCREMENT PRIMARY KEY,
  uid               VARCHAR(128) NOT NULL,
  category          VARCHAR(100) NOT NULL DEFAULT '',
  businessName      VARCHAR(255) NOT NULL,
  businessContact   VARCHAR(50) NOT NULL DEFAULT '',
  description       TEXT,
  location          VARCHAR(500) NOT NULL DEFAULT '',
  state             VARCHAR(100) NOT NULL DEFAULT '',
  lga               VARCHAR(100) DEFAULT NULL,
  yearsOfExperience INT DEFAULT NULL,
  feePerHour        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  businessLogo      VARCHAR(500) NOT NULL DEFAULT '',
  reviews           INT NOT NULL DEFAULT 0,
  rating            DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  verified          TINYINT(1) NOT NULL DEFAULT 0,
  suspended         TINYINT(1) NOT NULL DEFAULT 0,
  subscriptionCategory INT NOT NULL DEFAULT 0,
  activeSubscription   INT NOT NULL DEFAULT 0,
  dateStarted       DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted           TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_businesses_uid (uid),
  INDEX idx_businesses_category (category),
  INDEX idx_businesses_state_category_rating (state, category, rating DESC),
  INDEX idx_businesses_category_rating (category, rating DESC, deleted),
  INDEX idx_businesses_rating_deleted (rating DESC, reviews DESC, deleted),
  FULLTEXT INDEX ft_businesses_search (businessName, description, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS companies (
  company_id      INT AUTO_INCREMENT PRIMARY KEY,
  uid             VARCHAR(128) NOT NULL,
  company_name    VARCHAR(255) NOT NULL,
  company_logo    VARCHAR(500) DEFAULT NULL,
  company_address VARCHAR(500) DEFAULT NULL,
  company_email   VARCHAR(255) DEFAULT NULL,
  company_phone   VARCHAR(50) DEFAULT NULL,
  INDEX idx_companies_uid (uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vacancies (
  vacancy_id          INT AUTO_INCREMENT PRIMARY KEY,
  company_id          INT NOT NULL,
  vacancy_title       VARCHAR(255) NOT NULL,
  vacancy_location    VARCHAR(255) NOT NULL DEFAULT '',
  job_type            VARCHAR(50) NOT NULL DEFAULT '',
  work_type           VARCHAR(50) NOT NULL DEFAULT '',
  years_of_experience INT DEFAULT NULL,
  required_skills     TEXT,
  job_description     TEXT,
  closing_date        DATETIME DEFAULT NULL,
  date_created        DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed              TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_vacancies_company_id (company_id),
  INDEX idx_vacancies_location_type (vacancy_location, job_type, closed, date_created DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vacancy_applications (
  application_id INT AUTO_INCREMENT PRIMARY KEY,
  vacancy_id     INT NOT NULL,
  uid            VARCHAR(128) NOT NULL,
  cv             TEXT DEFAULT NULL,
  cover_letter   TEXT DEFAULT NULL,
  applied_date   DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vacancy_applications_vacancy_id (vacancy_id),
  INDEX idx_vacancy_applications_uid (uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bookings (
  bookingId              INT AUTO_INCREMENT PRIMARY KEY,
  bookingCode            VARCHAR(50) DEFAULT NULL,
  businessId             INT NOT NULL,
  clientUID              VARCHAR(128) NOT NULL,
  bookedDate             VARCHAR(50) NOT NULL DEFAULT '',
  bookedTime             VARCHAR(50) NOT NULL DEFAULT '',
  appointmentAddress     VARCHAR(500) NOT NULL DEFAULT '',
  meetingPoint           VARCHAR(500) NOT NULL DEFAULT '',
  additionalInfo         TEXT,
  bookingStatus          VARCHAR(50) NOT NULL DEFAULT 'Pending',
  clientDecision         VARCHAR(50) NOT NULL DEFAULT '',
  vendorDecision         VARCHAR(50) NOT NULL DEFAULT '',
  vendorComment          VARCHAR(500) NOT NULL DEFAULT '',
  amountAgreed           DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  priceConfirmed         TINYINT(1) NOT NULL DEFAULT 0,
  jobStatus              VARCHAR(50) NOT NULL DEFAULT '',
  dateBooked             DATETIME DEFAULT CURRENT_TIMESTAMP,
  reasonForCancellation  VARCHAR(500) NOT NULL DEFAULT '',
  INDEX idx_bookings_clientUID (clientUID),
  INDEX idx_bookings_businessId (businessId),
  INDEX idx_bookings_bookingStatus (bookingStatus),
  INDEX idx_bookings_business_status (businessId, bookingStatus),
  INDEX idx_bookings_client_status (clientUID, bookingStatus)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reviews (
  reviewId   INT AUTO_INCREMENT PRIMARY KEY,
  businessId INT NOT NULL,
  userUid    VARCHAR(128) NOT NULL,
  review     TEXT NOT NULL,
  bookingId  INT DEFAULT NULL,
  dateAdded  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reviews_businessId (businessId),
  INDEX idx_reviews_bookingId (bookingId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS business_ratings (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  userUid    VARCHAR(128) NOT NULL,
  businessId INT NOT NULL,
  rating     DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_business_rating (userUid, businessId),
  INDEX idx_business_ratings_businessId (businessId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS business_verifications (
  id                       INT AUTO_INCREMENT PRIMARY KEY,
  businessId               INT NOT NULL,
  nin                      VARCHAR(11) NOT NULL,
  photo_url                VARCHAR(500) DEFAULT NULL,
  nin_card_url             VARCHAR(500) DEFAULT NULL,
  utility_bill_url         VARCHAR(500) DEFAULT NULL,
  business_registration_url VARCHAR(500) DEFAULT NULL,
  trade_certificate_url    VARCHAR(500) DEFAULT NULL,
  status                   ENUM('pending','approved','rejected') DEFAULT 'pending',
  admin_notes              TEXT,
  submitted_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at              DATETIME DEFAULT NULL,
  INDEX idx_business_verifications_businessId (businessId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS favorites (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  uid         VARCHAR(128) NOT NULL,
  business_id INT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_favorites_uid (uid),
  UNIQUE KEY uk_user_business_fav (uid, business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wallets (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  email       VARCHAR(255) DEFAULT NULL,
  currency    VARCHAR(10) NOT NULL DEFAULT 'NGN',
  wallet_type VARCHAR(50) NOT NULL DEFAULT 'user',
  status      VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wallets_user_id (user_id),
  INDEX idx_wallets_type (wallet_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wallet_ledger (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  wallet_id      INT NOT NULL,
  amount         DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  direction      ENUM('credit','debit') NOT NULL,
  balance_after  DECIMAL(15,2) DEFAULT NULL,
  description    TEXT,
  transaction_id INT DEFAULT NULL,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wallet_ledger_wallet_id (wallet_id),
  INDEX idx_wallet_ledger_created (wallet_id, created_at DESC),
  INDEX idx_wallet_ledger_balance (wallet_id, direction, amount)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wallet_escrow (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  booking_id        INT NOT NULL,
  client_wallet_id  INT NOT NULL,
  vendor_wallet_id  INT NOT NULL,
  escrow_wallet_id  INT DEFAULT NULL,
  amount            DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  status            ENUM('held','released','refunded') DEFAULT 'held',
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  released_at       DATETIME DEFAULT NULL,
  INDEX idx_wallet_escrow_booking_id (booking_id),
  INDEX idx_wallet_escrow_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  reference  VARCHAR(255) NOT NULL,
  type       VARCHAR(50) NOT NULL DEFAULT '',
  status     VARCHAR(50) NOT NULL DEFAULT '',
  metadata   JSON DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wallet_transactions_reference (reference)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS withdrawal_accounts (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  bank_name      VARCHAR(255) NOT NULL DEFAULT '',
  bank_code      VARCHAR(20) NOT NULL DEFAULT '',
  account_number VARCHAR(20) NOT NULL DEFAULT '',
  account_name   VARCHAR(255) NOT NULL DEFAULT '',
  INDEX idx_withdrawal_accounts_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS withdrawals (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  wallet_id  INT DEFAULT NULL,
  user_id    INT NOT NULL,
  amount     DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  account_id INT DEFAULT NULL,
  status     VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_withdrawals_wallet_id (wallet_id),
  INDEX idx_withdrawals_user_id (user_id),
  INDEX idx_withdrawals_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS users_notifications (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  senderUid        VARCHAR(128) NOT NULL DEFAULT '',
  senderEmail      VARCHAR(255) NOT NULL DEFAULT '',
  recieverUid      VARCHAR(128) NOT NULL,
  recieverEmail    VARCHAR(255) NOT NULL DEFAULT '',
  body             TEXT NOT NULL,
  dateCreated      DATETIME DEFAULT CURRENT_TIMESTAMP,
  seenByReciever   TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_users_notifications_recieverUid (recieverUid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_fcm_tokens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  uid        VARCHAR(128) NOT NULL,
  token      VARCHAR(255) NOT NULL UNIQUE,
  is_active  TINYINT(1) DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_fcm_tokens_uid (uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS disputes (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  bookingId   INT NOT NULL,
  clientUid   VARCHAR(128) NOT NULL,
  vendorUid   VARCHAR(128) NOT NULL,
  raisedBy    VARCHAR(128) NOT NULL,
  reason      TEXT NOT NULL,
  status      ENUM('open','investigating','resolved','dismissed') DEFAULT 'open',
  resolution  TEXT,
  resolvedBy  VARCHAR(128) DEFAULT NULL,
  resolvedAt  DATETIME DEFAULT NULL,
  createdAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_disputes_bookingId (bookingId),
  INDEX idx_disputes_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  adminUid   VARCHAR(128) NOT NULL,
  action     VARCHAR(255) NOT NULL,
  targetType VARCHAR(64) DEFAULT NULL,
  targetId   VARCHAR(128) DEFAULT NULL,
  details    JSON DEFAULT NULL,
  createdAt  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admin_audit_log_adminUid (adminUid),
  INDEX idx_admin_audit_log_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

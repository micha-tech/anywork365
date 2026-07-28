ALTER TABLE users
  MODIFY COLUMN role ENUM('client','artisan','professional','recruiter','support','admin') DEFAULT NULL;

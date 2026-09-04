ALTER TABLE users
  MODIFY COLUMN role ENUM('client','artisan','professional','recruiter','intern','support','admin') DEFAULT NULL;

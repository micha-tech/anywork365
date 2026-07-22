ALTER TABLE vacancies
  ADD COLUMN posted_by_uid VARCHAR(128) DEFAULT NULL AFTER company_id,
  ADD COLUMN company_name VARCHAR(180) NOT NULL DEFAULT '' AFTER posted_by_uid,
  ADD COLUMN company_address VARCHAR(500) NOT NULL DEFAULT '' AFTER company_name,
  ADD COLUMN category VARCHAR(160) NOT NULL DEFAULT '' AFTER vacancy_title,
  ADD COLUMN budget DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER category,
  ADD COLUMN timeline VARCHAR(30) NOT NULL DEFAULT 'flexible' AFTER budget,
  ADD INDEX idx_vacancies_posted_by (posted_by_uid, date_created DESC),
  ADD INDEX idx_vacancies_deadline (closed, closing_date, date_created DESC);

ALTER TABLE vacancy_applications
  ADD COLUMN first_name VARCHAR(80) NOT NULL DEFAULT '' AFTER uid,
  ADD COLUMN last_name VARCHAR(80) NOT NULL DEFAULT '' AFTER first_name,
  ADD COLUMN cv_original_name VARCHAR(255) DEFAULT NULL AFTER cv,
  ADD COLUMN cv_mime_type VARCHAR(120) DEFAULT NULL AFTER cv_original_name,
  ADD COLUMN education JSON DEFAULT NULL AFTER cover_letter,
  ADD COLUMN work_experience JSON DEFAULT NULL AFTER education,
  ADD COLUMN status ENUM('pending','reviewing','shortlisted','rejected','hired') NOT NULL DEFAULT 'pending' AFTER work_experience;

DELETE newer
FROM vacancy_applications newer
JOIN vacancy_applications older
  ON older.vacancy_id = newer.vacancy_id
 AND older.uid = newer.uid
 AND older.application_id < newer.application_id;

ALTER TABLE vacancy_applications
  ADD UNIQUE KEY uk_vacancy_applicant (vacancy_id, uid),
  ADD INDEX idx_applications_status_date (status, applied_date DESC);

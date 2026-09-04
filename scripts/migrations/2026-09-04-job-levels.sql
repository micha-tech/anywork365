-- Add a searchable job-level category for recruiter postings.
ALTER TABLE vacancies
  ADD COLUMN job_level VARCHAR(40) NOT NULL DEFAULT 'mid-level' AFTER job_type;

UPDATE vacancies
SET job_level = 'internship'
WHERE job_type = 'internship';

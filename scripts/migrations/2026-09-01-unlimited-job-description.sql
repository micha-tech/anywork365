-- Allow job descriptions to grow beyond the previous TEXT limit.
ALTER TABLE vacancies
  MODIFY COLUMN job_description LONGTEXT NULL;

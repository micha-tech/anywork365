ALTER TABLE vacancies
  ADD COLUMN short_description VARCHAR(320) NOT NULL DEFAULT '' AFTER required_skills;

UPDATE vacancies
SET short_description = LEFT(TRIM(COALESCE(job_description, '')), 320)
WHERE short_description = '';

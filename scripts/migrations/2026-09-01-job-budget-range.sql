-- Store recruiter budgets as an explicit minimum and maximum.
ALTER TABLE vacancies
  ADD COLUMN budget_min DECIMAL(15,2) DEFAULT NULL AFTER budget,
  ADD COLUMN budget_max DECIMAL(15,2) DEFAULT NULL AFTER budget_min;

UPDATE vacancies
SET budget_min = budget,
    budget_max = budget
WHERE budget_min IS NULL OR budget_max IS NULL;

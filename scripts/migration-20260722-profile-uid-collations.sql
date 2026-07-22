ALTER TABLE professional_profiles
  MODIFY COLUMN uid VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL;

ALTER TABLE recruiter_profiles
  MODIFY COLUMN uid VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL;

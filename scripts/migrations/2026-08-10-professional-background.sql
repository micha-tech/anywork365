ALTER TABLE professional_profiles
  ADD COLUMN school_name VARCHAR(220) DEFAULT NULL AFTER qualification,
  ADD COLUMN certifications JSON DEFAULT NULL AFTER school_name,
  ADD COLUMN work_experience JSON DEFAULT NULL AFTER certifications;

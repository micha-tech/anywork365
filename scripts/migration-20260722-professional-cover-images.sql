ALTER TABLE professional_profiles
  ADD COLUMN cover_image_url VARCHAR(1000) DEFAULT NULL AFTER linkedin_or_portfolio_url;

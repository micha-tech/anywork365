-- Fix ER_IMPOSSIBLE_STRING_CONVERSION (errno 3988) on booking creation.
-- The bookings table predates the utf8mb4 baseline and still uses
-- latin1_swedish_ci while mysql2 sends parameters as utf8mb4_unicode_ci.
-- Non-ASCII input (e.g. ₦, en-dashes, emojis) then fails to convert.
-- Convert to utf8mb4 so the table matches the schema baseline and the
-- driver collation.

ALTER TABLE bookings
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- Fix ER_IMPOSSIBLE_STRING_CONVERSION (errno 3988) on booking creation.
-- The bookings table predates the utf8mb4 baseline and still used
-- latin1_swedish_ci while mysql2 sends parameters as utf8mb4_unicode_ci.
-- Non-ASCII input (e.g. ₦, en-dashes, emojis) then failed to convert.
--
-- Use utf8mb4_general_ci to match the DB-wide convention (users.uid,
-- booking_quotes.artisan_uid, financial/wallet *_uid columns are all
-- utf8mb4_general_ci) so joins and INSERTs share one collation.

ALTER TABLE bookings
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
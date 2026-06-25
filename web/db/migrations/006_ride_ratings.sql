ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS driver_rating smallint CHECK (driver_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS rating_feedback text CHECK (rating_feedback IS NULL OR char_length(rating_feedback) <= 280);

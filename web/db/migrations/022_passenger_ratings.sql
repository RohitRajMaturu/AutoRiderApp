-- Allow the assigned driver to rate the passenger after a completed ride.
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS passenger_rating smallint
    CHECK (passenger_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS passenger_rating_feedback text
    CHECK (
      passenger_rating_feedback IS NULL
      OR char_length(passenger_rating_feedback) <= 280
    );

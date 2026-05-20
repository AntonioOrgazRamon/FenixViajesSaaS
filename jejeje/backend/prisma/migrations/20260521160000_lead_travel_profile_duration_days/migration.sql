-- lead_travel_profiles: duración orientativa (días) para TravelSearchIntent
ALTER TABLE `lead_travel_profiles`
  ADD COLUMN `duration_days` INT NULL AFTER `flexible_dates`;

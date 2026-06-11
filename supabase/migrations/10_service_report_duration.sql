ALTER TABLE service_reports ADD COLUMN IF NOT EXISTS work_duration_minutes INT;
-- NO UPDATE statement — do not backfill historical rows

-- Add position detail columns to ac_units
ALTER TABLE public.ac_units ADD COLUMN IF NOT EXISTS room_location VARCHAR;
ALTER TABLE public.ac_units ADD COLUMN IF NOT EXISTS floor_level VARCHAR;
ALTER TABLE public.ac_units ADD COLUMN IF NOT EXISTS position_detail VARCHAR;

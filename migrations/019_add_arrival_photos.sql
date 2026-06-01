-- Migration: Add arrival_photos column to order_status_transitions
-- Supports technician arrival photo requirement (EN_ROUTE → IN_PROGRESS)
-- Stores photo URLs as TEXT array, same pattern as service_reports.photos_before

ALTER TABLE public.order_status_transitions
  ADD COLUMN IF NOT EXISTS arrival_photos TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.order_status_transitions.arrival_photos IS
  'Photos taken by technician at arrival (EN_ROUTE → IN_PROGRESS), max 3';
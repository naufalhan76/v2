-- =============================================================================
-- Drop service_pricing table — superseded by service_catalog.
-- service_pricing only ever held 6 default-fallback rows (one per service
-- type). All active flows now resolve pricing through service_catalog.
-- =============================================================================

DROP TABLE IF EXISTS public.service_pricing CASCADE;

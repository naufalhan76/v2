BEGIN;

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS lat NUMERIC,
  ADD COLUMN IF NOT EXISTS lng NUMERIC;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS lat NUMERIC,
  ADD COLUMN IF NOT EXISTS lng NUMERIC;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS customer_lat_override NUMERIC,
  ADD COLUMN IF NOT EXISTS customer_lng_override NUMERIC;

ALTER TABLE public.invoice_configuration
  ADD COLUMN IF NOT EXISTS company_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS company_lng NUMERIC;

COMMENT ON COLUMN public.locations.lat IS 'Latitude pinpoint set via AddressPicker; nullable.';
COMMENT ON COLUMN public.locations.lng IS 'Longitude pinpoint set via AddressPicker; nullable.';
COMMENT ON COLUMN public.customers.lat IS 'Latitude pinpoint for billing_address; nullable.';
COMMENT ON COLUMN public.customers.lng IS 'Longitude pinpoint for billing_address; nullable.';
COMMENT ON COLUMN public.invoices.customer_lat_override IS 'Latitude pinpoint for one-off blank invoice address override; nullable.';
COMMENT ON COLUMN public.invoices.customer_lng_override IS 'Longitude pinpoint for one-off blank invoice address override; nullable.';
COMMENT ON COLUMN public.invoice_configuration.company_lat IS 'Latitude pinpoint for company address shown on invoice PDF; nullable.';
COMMENT ON COLUMN public.invoice_configuration.company_lng IS 'Longitude pinpoint for company address shown on invoice PDF; nullable.';

COMMIT;

-- Migration: 04_invoice_number_rpc.sql
-- Creates sequence and RPC function for sequential invoice numbering

-- Sequence for invoice numbering
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1;

-- Function that generates sequential invoice numbers
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  prefix TEXT;
  seq_val INT;
  year_month TEXT;
BEGIN
  -- Get prefix from invoice_configuration (default 'INV')
  SELECT COALESCE(invoice_prefix, 'INV') INTO prefix
  FROM public.invoice_configuration
  WHERE is_active = true
  LIMIT 1;

  IF prefix IS NULL THEN
    prefix := 'INV';
  END IF;

  -- Get next sequence value
  seq_val := nextval('public.invoice_number_seq');

  -- Format: PREFIX/YYYY-MM/NNNNNN
  year_month := to_char(NOW(), 'YYYY-MM');

  RETURN prefix || '/' || year_month || '/' || to_char(seq_val, 'FM000000');
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO authenticated;

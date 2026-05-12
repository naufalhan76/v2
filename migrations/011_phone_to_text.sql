-- =============================================
-- Migration 011: Convert phone columns to TEXT
-- =============================================
-- Converts phone_number (customers) and contact_number (technicians)
-- from numeric/scientific-notation storage to plain TEXT.
-- Uses information_schema guards so the migration is idempotent.
-- Cleans up any existing rows stored as scientific notation by
-- casting through NUMERIC first, then BigInt-style truncation.

BEGIN;

-- -----------------------------------------------
-- 1. customers.phone_number
-- -----------------------------------------------
DO $$
BEGIN
  -- Only alter if the column is NOT already text/varchar
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'customers'
      AND column_name  = 'phone_number'
      AND data_type NOT IN ('text', 'character varying')
  ) THEN
    -- Convert column to TEXT, casting numeric values safely
    ALTER TABLE customers
      ALTER COLUMN phone_number TYPE TEXT
      USING CASE
        WHEN phone_number IS NULL THEN NULL
        ELSE trunc(phone_number::numeric)::bigint::text
      END;
  END IF;
END;
$$;

-- Clean up any rows that still contain scientific notation (e.g. '6.28138E+11')
-- after a previous partial migration or direct INSERT of numeric strings.
UPDATE customers
SET phone_number = trunc(phone_number::numeric)::bigint::text
WHERE phone_number IS NOT NULL
  AND phone_number ~ '^[0-9]+\.?[0-9]*[Ee][+\-]?[0-9]+$';

-- -----------------------------------------------
-- 2. technicians.contact_number
-- -----------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'technicians'
      AND column_name  = 'contact_number'
      AND data_type NOT IN ('text', 'character varying')
  ) THEN
    ALTER TABLE technicians
      ALTER COLUMN contact_number TYPE TEXT
      USING CASE
        WHEN contact_number IS NULL THEN NULL
        ELSE trunc(contact_number::numeric)::bigint::text
      END;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'technicians'
      AND column_name  = 'contact_number'
  ) THEN
    UPDATE technicians
    SET contact_number = trunc(contact_number::numeric)::bigint::text
    WHERE contact_number IS NOT NULL
      AND contact_number ~ '^[0-9]+\.?[0-9]*[Ee][+\-]?[0-9]+$';
  END IF;
END;
$$;

COMMIT;

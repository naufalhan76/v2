-- =============================================
-- Rollback 011: Revert phone columns to TEXT (no-op)
-- =============================================
-- TEXT is a superset of the previous numeric storage; reverting to a
-- numeric type would silently drop non-numeric phone strings (e.g. '+62-812-xxx').
-- Therefore this rollback is intentionally a no-op — the data is safe as TEXT.
--
-- If you need to revert to a specific numeric type for a particular reason,
-- uncomment and adapt the block below, accepting that non-numeric values will fail.

-- BEGIN;
--
-- ALTER TABLE customers
--   ALTER COLUMN phone_number TYPE NUMERIC
--   USING NULLIF(phone_number, '')::numeric;
--
-- ALTER TABLE technicians
--   ALTER COLUMN contact_number TYPE NUMERIC
--   USING NULLIF(contact_number, '')::numeric;
--
-- COMMIT;

SELECT 'Rollback 011: no destructive action taken — phone columns remain TEXT.' AS info;

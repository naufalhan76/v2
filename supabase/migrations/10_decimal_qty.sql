-- 10_decimal_qty: Change order_items.quantity from INT to NUMERIC for decimal quantities.
-- Also adjusts the default and check constraint.

ALTER TABLE public.order_items
  ALTER COLUMN quantity TYPE NUMERIC USING quantity::numeric;

ALTER TABLE public.order_items
  ALTER COLUMN quantity SET DEFAULT 1.0;

-- Drop the old inline CHECK constraint (Postgres auto-names it order_items_quantity_check).
-- We must drop it by finding its name dynamically, then add the new check.
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'order_items'
    AND con.conname LIKE '%quantity%check%'
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.order_items DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_quantity_check CHECK (quantity > 0.0);

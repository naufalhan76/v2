-- BUG-014: Prevent duplicate customer phone numbers
-- Partial unique index: allows multiple customers without a phone number,
-- but enforces uniqueness when phone_number is provided.
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique
  ON public.customers(phone_number)
  WHERE phone_number IS NOT NULL AND phone_number <> '';

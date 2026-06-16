-- Add idempotency_key column to payment_records
ALTER TABLE public.payment_records ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_records_idempotency ON payment_records(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- RPC: record_payment_v2
-- Wraps payment recording in a single transaction with row-level locking and idempotency.
CREATE OR REPLACE FUNCTION public.record_payment_v2(
  p_invoice_id TEXT,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_payment_date TEXT,
  p_reference_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_recorded_by TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_remaining NUMERIC;
  v_new_paid NUMERIC;
  v_payment_status TEXT;
  v_new_status TEXT;
  v_payment_id UUID;
  v_existing_payment UUID;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT payment_id INTO v_existing_payment
    FROM payment_records WHERE idempotency_key = p_idempotency_key;
    IF v_existing_payment IS NOT NULL THEN
      RETURN jsonb_build_object('payment_id', v_existing_payment, 'idempotent', true);
    END IF;
  END IF;

  -- Lock invoice row
  SELECT invoice_id, total_amount, paid_amount, status, order_id, invoice_type
  INTO v_invoice
  FROM invoices WHERE invoice_id = p_invoice_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice tidak ditemukan'; END IF;

  -- Status guards
  IF v_invoice.status IS NULL OR v_invoice.status = 'DRAFT' THEN
    RAISE EXCEPTION 'Invoice masih dalam status DRAFT';
  END IF;
  IF v_invoice.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'Tidak bisa mencatat pembayaran untuk invoice yang sudah dibatalkan';
  END IF;

  -- Amount validation
  v_remaining := v_invoice.total_amount - COALESCE(v_invoice.paid_amount, 0);
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Jumlah pembayaran harus lebih dari 0'; END IF;
  IF p_amount > v_remaining THEN RAISE EXCEPTION 'Jumlah melebihi sisa tagihan'; END IF;

  -- Calculate new amounts
  v_new_paid := COALESCE(v_invoice.paid_amount, 0) + p_amount;
  IF v_new_paid >= v_invoice.total_amount THEN
    v_payment_status := 'PAID'; v_new_status := 'PAID';
  ELSIF v_new_paid > 0 THEN
    v_payment_status := 'PARTIAL_PAID'; v_new_status := 'PARTIAL_PAID';
  ELSE
    v_payment_status := 'UNPAID'; v_new_status := 'SENT';
  END IF;

  -- Insert payment record
  INSERT INTO payment_records (invoice_id, payment_date, payment_method, amount, reference_number, notes, recorded_by, idempotency_key)
  VALUES (p_invoice_id, p_payment_date::date, p_payment_method, p_amount, p_reference_number, p_notes, p_recorded_by::uuid, p_idempotency_key)
  RETURNING payment_id INTO v_payment_id;

  -- Update invoice
  UPDATE invoices SET paid_amount = v_new_paid, payment_status = v_payment_status, status = v_new_status, updated_at = NOW()
  WHERE invoice_id = p_invoice_id;

  -- Sync order to PAID if FINAL invoice fully paid
  IF v_payment_status = 'PAID' AND v_invoice.order_id IS NOT NULL AND v_invoice.invoice_type = 'FINAL' THEN
    UPDATE orders SET status = 'PAID', updated_at = NOW() WHERE order_id = v_invoice.order_id;
  END IF;

  RETURN jsonb_build_object('payment_id', v_payment_id, 'idempotent', false, 'new_paid_amount', v_new_paid, 'payment_status', v_payment_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_payment_v2(text, numeric, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_v2(text, numeric, text, text, text, text, text, text) TO service_role;

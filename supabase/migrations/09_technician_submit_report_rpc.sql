-- Create technician_submit_report_v2 RPC
-- Handles report submission, AC unit updates, status transition, and idempotency in one transaction.

CREATE OR REPLACE FUNCTION public.technician_submit_report_v2(
  p_order_id TEXT,
  p_technician_id TEXT,
  p_payload JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_id UUID;
  v_idempotency_key TEXT;
  v_ac_unit JSONB;
  v_ac_unit_id TEXT;
  v_next_service_date DATE;
BEGIN
  -- 1. Extract and check idempotency
  v_idempotency_key := p_payload->>'idempotency_key';
  
  IF v_idempotency_key IS NOT NULL THEN
    SELECT report_id INTO v_report_id
    FROM public.service_reports
    WHERE order_id = p_order_id
      AND idempotency_key = v_idempotency_key
      AND deleted_at IS NULL;
      
    IF v_report_id IS NOT NULL THEN
      RETURN v_report_id;
    END IF;
  END IF;

  -- Extract recommendation date if present
  IF p_payload->>'next_service_recommendation_date' IS NOT NULL AND p_payload->>'next_service_recommendation_date' <> '' THEN
    v_next_service_date := (p_payload->>'next_service_recommendation_date')::date;
  ELSE
    v_next_service_date := NULL;
  END IF;

  -- 2. Insert into service_reports
  INSERT INTO public.service_reports (
    order_id,
    technician_id,
    photos_before,
    photos_after,
    materials,
    actual_total_price,
    customer_signature_url,
    customer_name_signed,
    signed_at,
    notes,
    work_started_at,
    work_completed_at,
    next_service_recommendation_date,
    next_service_recommendation_notes,
    idempotency_key
  )
  VALUES (
    p_order_id,
    p_technician_id,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'photos_before', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'photos_after', '[]'::jsonb))),
    COALESCE(p_payload->'materials', '[]'::jsonb),
    (p_payload->>'actual_total_price')::numeric,
    p_payload->>'customer_signature_url',
    p_payload->>'customer_name_signed',
    NOW(), -- signed_at
    COALESCE(p_payload->>'notes', ''),
    (p_payload->>'work_started_at')::timestamptz,
    (p_payload->>'work_completed_at')::timestamptz,
    v_next_service_date,
    p_payload->>'next_service_recommendation_notes',
    v_idempotency_key
  )
  RETURNING report_id INTO v_report_id;

  -- 3. Update AC units details
  FOR v_ac_unit IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'ac_units', '[]'::jsonb)) LOOP
    v_ac_unit_id := v_ac_unit->>'ac_unit_id';
    
    IF v_ac_unit_id IS NOT NULL AND v_ac_unit_id <> '' THEN
      -- Update existing AC unit
      UPDATE public.ac_units
      SET
        brand = COALESCE(v_ac_unit->>'brand', brand),
        brand_id = COALESCE((v_ac_unit->>'brand_id')::uuid, brand_id),
        unit_type_id = COALESCE((v_ac_unit->>'unit_type_id')::uuid, unit_type_id),
        capacity_id = COALESCE((v_ac_unit->>'capacity_id')::uuid, capacity_id),
        model_number = COALESCE(v_ac_unit->>'model_number', model_number),
        serial_number = COALESCE(v_ac_unit->>'serial_number', serial_number),
        room_location = COALESCE(v_ac_unit->>'room_location', room_location),
        floor_level = COALESCE(v_ac_unit->>'floor_level', floor_level),
        position_detail = COALESCE(v_ac_unit->>'position_detail', position_detail),
        ac_type = COALESCE(v_ac_unit->>'ac_type', ac_type),
        last_service_date = CURRENT_DATE,
        next_service_due_date = COALESCE(v_next_service_date, next_service_due_date),
        updated_at = NOW()
      WHERE ac_unit_id = v_ac_unit_id;
    END IF;
  END LOOP;

  -- 4. Transition order status from IN_PROGRESS to COMPLETED
  UPDATE public.orders
  SET status = 'COMPLETED',
      updated_at = NOW()
  WHERE order_id = p_order_id;

  -- 5. Insert order transition row
  INSERT INTO public.order_status_transitions (
    order_id,
    from_status,
    to_status,
    notes,
    idempotency_key,
    changed_at
  )
  VALUES (
    p_order_id,
    'IN_PROGRESS',
    'COMPLETED',
    'Report submitted by technician. Order completed.',
    v_idempotency_key,
    NOW()
  );

  RETURN v_report_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.technician_submit_report_v2(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.technician_submit_report_v2(text, text, jsonb) TO service_role;

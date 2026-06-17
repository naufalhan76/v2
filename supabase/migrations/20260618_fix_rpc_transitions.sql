CREATE OR REPLACE FUNCTION public.technician_submit_report_v2(
  p_order_id TEXT,
  p_technician_id TEXT,
  p_payload JSONB,
  p_work_duration_minutes INT DEFAULT NULL
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
  v_new_ac_location_id TEXT;
  v_customer_id TEXT;
  v_order_status TEXT;
  v_existing_ac RECORD;
  v_order_item_id UUID;
  v_order_item_match_count INT;
  v_material JSONB;
  v_addon_id UUID;
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

  SELECT customer_id, status INTO v_customer_id, v_order_status
  FROM public.orders
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order_status <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'Cannot submit report when order is %', v_order_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.order_technicians
    WHERE order_id = p_order_id
      AND technician_id = p_technician_id
      AND role = 'lead'
  ) THEN
    RAISE EXCEPTION 'Not assigned as lead technician for this order';
  END IF;

  -- Extract recommendation date if present
  IF p_payload->>'next_service_recommendation_date' IS NOT NULL AND p_payload->>'next_service_recommendation_date' <> '' THEN
    v_next_service_date := (p_payload->>'next_service_recommendation_date')::date;
  ELSE
    v_next_service_date := NULL;
  END IF;

  FOR v_material IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'materials', '[]'::jsonb)) LOOP
    v_addon_id := NULLIF(v_material->>'addon_id', '')::uuid;

    IF v_addon_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.addon_catalog ac
        WHERE ac.addon_id = v_addon_id
          AND ac.is_active = true
      ) THEN
        RAISE EXCEPTION 'Catalog addon % is inactive, deleted, or unavailable. Refresh material catalog and reselect.', v_addon_id;
      END IF;
    END IF;
  END LOOP;

  -- 2. Insert into service_reports (preserve ac_units payload)
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
    work_duration_minutes,
    next_service_recommendation_date,
    next_service_recommendation_notes,
    ac_units,
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
    NOW(),
    COALESCE(p_payload->>'notes', ''),
    (p_payload->>'work_started_at')::timestamptz,
    (p_payload->>'work_completed_at')::timestamptz,
    COALESCE(p_work_duration_minutes, NULLIF(p_payload->>'work_duration_minutes', '')::int),
    v_next_service_date,
    p_payload->>'next_service_recommendation_notes',
    COALESCE(p_payload->'ac_units', '[]'::jsonb),
    v_idempotency_key
  )
  RETURNING report_id INTO v_report_id;

  FOR v_material IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'materials', '[]'::jsonb)) LOOP
    IF COALESCE((v_material->>'is_manual')::boolean, false)
      AND NULLIF(v_material->>'addon_id', '') IS NULL THEN
      INSERT INTO public.addon_requests (
        requested_by_technician_id,
        category,
        item_name,
        proposed_unit_price,
        unit_of_measure,
        description,
        status
      )
      VALUES (
        p_technician_id,
        COALESCE(NULLIF(v_material->>'category', ''), 'PARTS'),
        v_material->>'name',
        NULLIF(v_material->>'unit_price', '')::numeric,
        COALESCE(NULLIF(v_material->>'unit_of_measure', ''), 'pcs'),
        COALESCE(NULLIF(v_material->>'description', ''), 'Auto-submitted dari laporan ' || v_report_id::text),
        'PENDING'
      );
    END IF;
  END LOOP;

  FOR v_ac_unit IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'ac_units', '[]'::jsonb)) LOOP
    v_ac_unit_id := v_ac_unit->>'ac_unit_id';
    
    IF v_ac_unit_id IS NOT NULL AND v_ac_unit_id <> '' THEN
      SELECT au.* INTO v_existing_ac
      FROM public.ac_units au
      JOIN public.locations l ON l.location_id = au.location_id
      JOIN public.order_items oi ON oi.ac_unit_id = au.ac_unit_id
      WHERE au.ac_unit_id = v_ac_unit_id
        AND oi.order_id = p_order_id
        AND l.customer_id = v_customer_id
        AND au.location_id = oi.location_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'AC unit % is not valid for this order/customer/location', v_ac_unit_id;
      END IF;

      IF v_existing_ac.brand_id IS NOT NULL
        AND NULLIF(v_ac_unit->>'brand_id', '') IS NOT NULL
        AND v_existing_ac.brand_id <> (v_ac_unit->>'brand_id')::uuid THEN
        RAISE EXCEPTION 'Existing AC % brand_id cannot be overwritten', v_ac_unit_id;
      END IF;

      IF v_existing_ac.unit_type_id IS NOT NULL
        AND NULLIF(v_ac_unit->>'unit_type_id', '') IS NOT NULL
        AND v_existing_ac.unit_type_id <> (v_ac_unit->>'unit_type_id')::uuid THEN
        RAISE EXCEPTION 'Existing AC % unit_type_id cannot be overwritten', v_ac_unit_id;
      END IF;

      IF v_existing_ac.capacity_id IS NOT NULL
        AND NULLIF(v_ac_unit->>'capacity_id', '') IS NOT NULL
        AND v_existing_ac.capacity_id <> (v_ac_unit->>'capacity_id')::uuid THEN
        RAISE EXCEPTION 'Existing AC % capacity_id cannot be overwritten', v_ac_unit_id;
      END IF;

      UPDATE public.ac_units
      SET
        brand = COALESCE(NULLIF(brand, ''), NULLIF(v_ac_unit->>'brand', '')),
        brand_id = COALESCE(brand_id, NULLIF(v_ac_unit->>'brand_id', '')::uuid),
        unit_type_id = COALESCE(unit_type_id, NULLIF(v_ac_unit->>'unit_type_id', '')::uuid),
        capacity_id = COALESCE(capacity_id, NULLIF(v_ac_unit->>'capacity_id', '')::uuid),
        model_number = COALESCE(NULLIF(model_number, ''), NULLIF(v_ac_unit->>'model_number', '')),
        serial_number = COALESCE(NULLIF(serial_number, ''), NULLIF(v_ac_unit->>'serial_number', '')),
        room_location = COALESCE(NULLIF(room_location, ''), NULLIF(v_ac_unit->>'room_location', '')),
        floor_level = COALESCE(NULLIF(floor_level, ''), NULLIF(v_ac_unit->>'floor_level', '')),
        position_detail = COALESCE(NULLIF(position_detail, ''), NULLIF(v_ac_unit->>'position_detail', '')),
        ac_type = COALESCE(NULLIF(ac_type, ''), NULLIF(v_ac_unit->>'ac_type', '')),
        last_service_date = CURRENT_DATE,
        next_service_due_date = COALESCE(v_next_service_date, next_service_due_date),
        updated_at = NOW()
      WHERE ac_unit_id = v_ac_unit_id;
    ELSE
      -- New AC unit (ac_unit_id is NULL or empty): SKIP auto-creation
      -- Only preserve the payload in service_reports.ac_units
      -- Admin will manually create the AC unit via dashboard
      NULL;
    END IF;
  END LOOP;

  -- 4. Transition order status from IN_PROGRESS to COMPLETED
  UPDATE public.orders
  SET status = 'COMPLETED',
      updated_at = NOW()
  WHERE order_id = p_order_id
    AND status = 'IN_PROGRESS';

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

GRANT EXECUTE ON FUNCTION public.technician_submit_report_v2(text, text, jsonb, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.technician_submit_report_v2(text, text, jsonb, int) TO service_role;

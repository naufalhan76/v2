-- technician_submit_report_v3: Add stock deduction + price override prevention (BUG-005 + BUG-012)
-- Replaces technician_submit_report_v2 entirely.
-- Changes:
--   1. Price override: catalog materials use addon_catalog.unit_price regardless of tech-submitted price
--   2. Stock deduction: addon_catalog.stock_quantity decremented for catalog materials (can go negative)
--   3. Manual materials (is_manual=true) skip both stock deduction and price override

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
  -- New: price override and stock deduction
  v_catalog_price NUMERIC;
  v_corrected_materials JSONB := '[]'::jsonb;
  v_corrected_total NUMERIC := 0;
BEGIN
  -- 0. Price override: replace tech prices with catalog prices for non-manual materials
  FOR v_material IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'materials', '[]'::jsonb)) LOOP
    v_addon_id := NULLIF(v_material->>'addon_id', '')::uuid;

    IF v_addon_id IS NOT NULL AND COALESCE((v_material->>'is_manual')::boolean, false) = false THEN
      SELECT ac.unit_price INTO v_catalog_price
      FROM addon_catalog ac
      WHERE ac.addon_id = v_addon_id;

      IF v_catalog_price IS NOT NULL THEN
        v_material := jsonb_set(v_material, '{unit_price}', to_jsonb(v_catalog_price));
        v_material := jsonb_set(v_material, '{total}', to_jsonb(v_catalog_price * COALESCE((v_material->>'qty')::numeric, 1.0)));
      END IF;
    END IF;

    v_corrected_materials := v_corrected_materials || jsonb_build_array(v_material);
  END LOOP;

  -- Calculate corrected total from materials
  SELECT COALESCE(SUM((m->>'total')::numeric), 0) INTO v_corrected_total
  FROM jsonb_array_elements(v_corrected_materials) m;

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

  -- Validate materials against catalog (using corrected materials)
  FOR v_material IN SELECT * FROM jsonb_array_elements(v_corrected_materials) LOOP
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

  -- 2. Insert into service_reports (using corrected materials and corrected total)
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
    idempotency_key
  )
  VALUES (
    p_order_id,
    p_technician_id,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'photos_before', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'photos_after', '[]'::jsonb))),
    v_corrected_materials,
    v_corrected_total,
    p_payload->>'customer_signature_url',
    p_payload->>'customer_name_signed',
    NOW(), -- signed_at
    COALESCE(p_payload->>'notes', ''),
    (p_payload->>'work_started_at')::timestamptz,
    (p_payload->>'work_completed_at')::timestamptz,
    COALESCE(p_work_duration_minutes, NULLIF(p_payload->>'work_duration_minutes', '')::int),
    v_next_service_date,
    p_payload->>'next_service_recommendation_notes',
    v_idempotency_key
  )
  RETURNING report_id INTO v_report_id;

  -- 3. Auto-submit addon requests for manual materials
  FOR v_material IN SELECT * FROM jsonb_array_elements(v_corrected_materials) LOOP
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

  -- 3b. Stock deduction for catalog materials (can go negative — field work must not be blocked)
  FOR v_material IN SELECT * FROM jsonb_array_elements(v_corrected_materials) LOOP
    v_addon_id := NULLIF(v_material->>'addon_id', '')::uuid;

    IF v_addon_id IS NOT NULL AND COALESCE((v_material->>'is_manual')::boolean, false) = false THEN
      UPDATE addon_catalog
      SET stock_quantity = stock_quantity - COALESCE((v_material->>'qty')::numeric, 1.0),
          updated_at = NOW()
      WHERE addon_id = v_addon_id;
    END IF;
  END LOOP;

  -- 4. AC unit handling (update existing or insert new)
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
      IF NULLIF(v_ac_unit->>'brand_id', '') IS NULL
        OR NULLIF(v_ac_unit->>'unit_type_id', '') IS NULL
        OR NULLIF(v_ac_unit->>'capacity_id', '') IS NULL
        OR NULLIF(v_ac_unit->>'room_location', '') IS NULL THEN
        RAISE EXCEPTION 'New AC requires brand_id, unit_type_id, capacity_id, and room_location';
      END IF;

      v_new_ac_location_id := NULL;
      v_order_item_id := NULLIF(v_ac_unit->>'order_item_id', '')::uuid;

      IF v_order_item_id IS NOT NULL THEN
        SELECT oi.location_id INTO v_new_ac_location_id
        FROM public.order_items oi
        JOIN public.locations l ON l.location_id = oi.location_id
        WHERE oi.order_id = p_order_id
          AND oi.order_item_id = v_order_item_id
          AND oi.ac_unit_id IS NULL
          AND l.customer_id = v_customer_id
          AND oi.brand_id = NULLIF(v_ac_unit->>'brand_id', '')::uuid
          AND oi.unit_type_id = NULLIF(v_ac_unit->>'unit_type_id', '')::uuid
          AND oi.capacity_id = NULLIF(v_ac_unit->>'capacity_id', '')::uuid
          AND (
            NULLIF(v_ac_unit->>'catalog_id', '') IS NULL
            OR oi.catalog_id = NULLIF(v_ac_unit->>'catalog_id', '')::uuid
          )
          AND (
            NULLIF(v_ac_unit->>'service_type_id', '') IS NULL
            OR oi.service_type_id = NULLIF(v_ac_unit->>'service_type_id', '')::uuid
          )
          AND (
            NULLIF(v_ac_unit->>'msn_code', '') IS NULL
            OR oi.msn_code = NULLIF(v_ac_unit->>'msn_code', '')
          );

        IF v_new_ac_location_id IS NULL THEN
          RAISE EXCEPTION 'New AC order_item_id % is not valid for this order/customer/location', v_order_item_id;
        END IF;
      ELSE
        SELECT COUNT(*), MIN(oi.location_id) INTO v_order_item_match_count, v_new_ac_location_id
        FROM public.order_items oi
        JOIN public.locations l ON l.location_id = oi.location_id
        WHERE oi.order_id = p_order_id
          AND oi.ac_unit_id IS NULL
          AND l.customer_id = v_customer_id
          AND oi.brand_id = NULLIF(v_ac_unit->>'brand_id', '')::uuid
          AND oi.unit_type_id = NULLIF(v_ac_unit->>'unit_type_id', '')::uuid
          AND oi.capacity_id = NULLIF(v_ac_unit->>'capacity_id', '')::uuid
          AND (
            NULLIF(v_ac_unit->>'catalog_id', '') IS NULL
            OR oi.catalog_id = NULLIF(v_ac_unit->>'catalog_id', '')::uuid
          )
          AND (
            NULLIF(v_ac_unit->>'service_type_id', '') IS NULL
            OR oi.service_type_id = NULLIF(v_ac_unit->>'service_type_id', '')::uuid
          )
          AND (
            NULLIF(v_ac_unit->>'msn_code', '') IS NULL
            OR oi.msn_code = NULLIF(v_ac_unit->>'msn_code', '')
          );

        IF v_order_item_match_count <> 1 OR v_new_ac_location_id IS NULL THEN
          RAISE EXCEPTION 'New AC payload must match exactly one order item/location; matched %', v_order_item_match_count;
        END IF;
      END IF;

      INSERT INTO public.ac_units (
        location_id,
        brand,
        brand_id,
        unit_type_id,
        capacity_id,
        model_number,
        serial_number,
        ac_type,
        room_location,
        floor_level,
        position_detail,
        last_service_date,
        next_service_due_date,
        status
      ) VALUES (
        v_new_ac_location_id,
        NULLIF(v_ac_unit->>'brand', ''),
        NULLIF(v_ac_unit->>'brand_id', '')::uuid,
        NULLIF(v_ac_unit->>'unit_type_id', '')::uuid,
        NULLIF(v_ac_unit->>'capacity_id', '')::uuid,
        NULLIF(v_ac_unit->>'model_number', ''),
        NULLIF(v_ac_unit->>'serial_number', ''),
        NULLIF(v_ac_unit->>'ac_type', ''),
        NULLIF(v_ac_unit->>'room_location', ''),
        NULLIF(v_ac_unit->>'floor_level', ''),
        NULLIF(v_ac_unit->>'position_detail', ''),
        CURRENT_DATE,
        v_next_service_date,
        'ACTIVE'
      ) RETURNING ac_unit_id INTO v_ac_unit_id;
    END IF;
  END LOOP;

  -- 5. Transition order status from IN_PROGRESS to COMPLETED
  UPDATE public.orders
  SET status = 'COMPLETED',
      updated_at = NOW()
  WHERE order_id = p_order_id
    AND status = 'IN_PROGRESS';

  -- 6. Insert order transition row
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

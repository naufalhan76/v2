CREATE OR REPLACE FUNCTION public.technician_submit_report_v2(
  p_order_id TEXT,
  p_technician_id TEXT,
  p_payload JSONB,
  p_work_duration_minutes INTEGER DEFAULT NULL
) RETURNS UUID AS $$
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
  v_idempotency_key := p_payload->>'idempotency_key';

  SELECT status INTO v_order_status
  FROM public.orders
  WHERE order_id = p_order_id;

  IF v_order_status IS DISTINCT FROM 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'Order must be IN_PROGRESS to submit a report';
  END IF;

  SELECT COUNT(*) INTO v_order_item_match_count
  FROM public.order_items
  WHERE order_id = p_order_id;

  IF v_order_item_match_count = 0 THEN
    RAISE EXCEPTION 'Order has no order_items';
  END IF;

  v_next_service_date := COALESCE(
    (p_payload->>'next_service_recommendation_date')::date,
    NOW() + INTERVAL '6 months'
  );

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
    v_next_service_date,
    p_payload->>'next_service_recommendation_notes',
    COALESCE(p_payload->'ac_units', '[]'::jsonb),
    v_idempotency_key
  ) RETURNING report_id INTO v_report_id;

  FOR v_ac_unit IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'ac_units', '[]'::jsonb))
  LOOP
    v_ac_unit_id := v_ac_unit->>'ac_unit_id';

    IF v_ac_unit_id IS NOT NULL THEN
      SELECT * INTO v_existing_ac FROM public.ac_units WHERE ac_unit_id = v_ac_unit_id;

      IF v_existing_ac IS NOT NULL THEN
        UPDATE public.ac_units
        SET
          last_service_date = NOW(),
          next_service_due_date = v_next_service_date,
          updated_at = NOW()
        WHERE ac_unit_id = v_ac_unit_id;
      END IF;
    ELSE
      SELECT location_id INTO v_new_ac_location_id
      FROM public.order_items
      WHERE order_id = p_order_id
      LIMIT 1;
    END IF;

    IF v_ac_unit->'materials_used' IS NOT NULL AND jsonb_array_length(v_ac_unit->'materials_used') > 0 THEN
      FOR v_material IN SELECT * FROM jsonb_array_elements(v_ac_unit->'materials_used')
      LOOP
        v_addon_id := (v_material->>'addon_id')::uuid;

        IF v_addon_id IS NOT NULL THEN
          INSERT INTO public.order_addons (
            order_id,
            addon_id,
            quantity,
            unit_price,
            total_price
          ) VALUES (
            p_order_id,
            v_addon_id,
            COALESCE((v_material->>'qty')::numeric, 1.0),
            COALESCE((v_material->>'unit_price')::numeric, 0),
            COALESCE((v_material->>'total')::numeric, 0)
          )
          ON CONFLICT (order_id, addon_id) DO UPDATE SET
            quantity = EXCLUDED.quantity,
            unit_price = EXCLUDED.unit_price,
            total_price = EXCLUDED.total_price,
            updated_at = NOW();
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  INSERT INTO public.order_status_transitions (
    order_id,
    from_status,
    to_status,
    notes,
    idempotency_key,
    transition_date
  ) VALUES (
    p_order_id,
    'IN_PROGRESS',
    'COMPLETED',
    'Report submitted by technician. Order completed.',
    v_idempotency_key,
    NOW()
  );

  UPDATE public.orders
  SET
    status = 'COMPLETED',
    updated_at = NOW()
  WHERE order_id = p_order_id;

  RETURN v_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

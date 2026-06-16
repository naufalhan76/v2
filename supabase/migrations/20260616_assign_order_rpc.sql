-- RPC: assign_order_to_technician
-- Wraps order assignment in a transaction with row-level locking to prevent
-- concurrent assignment race conditions (two admins assigning different
-- technicians to the same order simultaneously).
CREATE OR REPLACE FUNCTION public.assign_order_to_technician(
  p_order_ids TEXT[],
  p_lead_technician_id TEXT,
  p_helper_ids TEXT[] DEFAULT '{}',
  p_scheduled_date TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id TEXT;
  v_prev_status TEXT;
  v_results JSONB := '[]'::jsonb;
BEGIN
  FOREACH v_order_id IN ARRAY p_order_ids LOOP
    -- Lock the order row
    SELECT status INTO v_prev_status
    FROM orders WHERE order_id = v_order_id FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Order % not found', v_order_id;
    END IF;

    -- Delete existing assignments
    DELETE FROM order_technicians WHERE order_id = v_order_id;

    -- Insert lead
    INSERT INTO order_technicians (order_id, technician_id, role, assigned_at)
    VALUES (v_order_id, p_lead_technician_id, 'lead', NOW());

    -- Insert helpers
    IF array_length(p_helper_ids, 1) > 0 THEN
      INSERT INTO order_technicians (order_id, technician_id, role, assigned_at)
      SELECT v_order_id, unnest(p_helper_ids), 'helper', NOW();
    END IF;

    -- Update order
    UPDATE orders SET
      status = 'ASSIGNED',
      assigned_technician_id = p_lead_technician_id,
      scheduled_visit_date = COALESCE(p_scheduled_date::date, scheduled_visit_date),
      updated_at = NOW()
    WHERE order_id = v_order_id;

    IF v_prev_status <> 'ASSIGNED' THEN
      INSERT INTO order_status_transitions (order_id, from_status, to_status, notes, transition_date)
      VALUES (v_order_id, v_prev_status::order_status, 'ASSIGNED'::order_status,
        CASE WHEN v_prev_status = 'PENDING' THEN 'Assigned to technician'
             ELSE 'Reassigned by admin (was ' || v_prev_status || ')' END,
        NOW());
    END IF;

    v_results := v_results || jsonb_build_object('order_id', v_order_id, 'prev_status', v_prev_status);
  END LOOP;

  RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_order_to_technician(text[], text, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_order_to_technician(text[], text, text[], text) TO service_role;

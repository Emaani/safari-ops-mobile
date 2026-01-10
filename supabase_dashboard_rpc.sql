-- ============================================================================
-- SUPABASE RPC FUNCTION FOR LOCKED DASHBOARD METRICS
-- ============================================================================
-- This function calculates accurate dashboard KPIs and returns locked metrics
-- that cannot be modified by client-side code
--
-- Usage: SELECT * FROM get_dashboard_metrics(filter_month, filter_year, currency);
-- Example: SELECT * FROM get_dashboard_metrics(0, 2026, 'USD');
-- ============================================================================

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  filter_month INTEGER DEFAULT NULL,  -- 0-11 for Jan-Dec, NULL for all months
  filter_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  display_currency TEXT DEFAULT 'USD'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  start_date_filter TIMESTAMP;
  end_date_filter TIMESTAMP;
  total_revenue NUMERIC := 0;
  total_expenses NUMERIC := 0;
  active_bookings_count INTEGER := 0;
  fleet_utilization NUMERIC := 0;
  outstanding_payments NUMERIC := 0;
  revenue_mtd NUMERIC := 0;
  revenue_ytd NUMERIC := 0;
  total_fleet INTEGER := 0;
  vehicles_hired INTEGER := 0;

  -- Conversion rates (hardcoded for consistency)
  rate_usd NUMERIC := 1;
  rate_ugx NUMERIC := 3670;
  rate_kes NUMERIC := 130;
  conversion_rate NUMERIC;
BEGIN
  -- Set conversion rate based on display currency
  IF display_currency = 'UGX' THEN
    conversion_rate := rate_ugx;
  ELSIF display_currency = 'KES' THEN
    conversion_rate := rate_kes;
  ELSE
    conversion_rate := rate_usd;
  END IF;

  -- Calculate date filters
  IF filter_month IS NOT NULL THEN
    start_date_filter := make_date(filter_year, filter_month + 1, 1);
    end_date_filter := (start_date_filter + INTERVAL '1 month' - INTERVAL '1 second');
  ELSE
    start_date_filter := make_date(filter_year, 1, 1);
    end_date_filter := make_date(filter_year, 12, 31) + INTERVAL '23 hours 59 minutes 59 seconds';
  END IF;

  -- ============================================================================
  -- CALCULATE TOTAL REVENUE
  -- Revenue = amount_paid from eligible bookings (Completed, In-Progress, or Confirmed with payment)
  -- ============================================================================
  SELECT COALESCE(SUM(
    CASE
      WHEN currency = 'USD' THEN amount_paid * conversion_rate
      WHEN currency = 'UGX' THEN (amount_paid / rate_ugx) * conversion_rate
      WHEN currency = 'KES' THEN (amount_paid / rate_kes) * conversion_rate
      ELSE amount_paid * conversion_rate
    END
  ), 0)
  INTO total_revenue
  FROM bookings
  WHERE (
    status IN ('Completed', 'In-Progress')
    OR (status = 'Confirmed' AND amount_paid > 0)
  )
  AND (
    filter_month IS NULL
    OR (start_date >= start_date_filter AND start_date <= end_date_filter)
  );

  -- ============================================================================
  -- CALCULATE TOTAL EXPENSES
  -- Expenses from Cash Requisitions (Completed/Approved/Resolved)
  -- ============================================================================
  SELECT COALESCE(SUM(
    CASE
      WHEN amount_usd IS NOT NULL THEN amount_usd * conversion_rate
      WHEN currency = 'USD' THEN total_amount * conversion_rate
      WHEN currency = 'UGX' THEN (total_amount / rate_ugx) * conversion_rate
      WHEN currency = 'KES' THEN (total_amount / rate_kes) * conversion_rate
      ELSE total_amount * conversion_rate
    END
  ), 0)
  INTO total_expenses
  FROM cash_requisitions
  WHERE status IN ('Completed', 'Approved', 'Resolved')
  AND soft_deleted = FALSE
  AND (
    filter_month IS NULL
    OR (created_at >= start_date_filter AND created_at <= end_date_filter)
  );

  -- ============================================================================
  -- CALCULATE ACTIVE BOOKINGS
  -- Active = In-Progress bookings
  -- ============================================================================
  SELECT COUNT(*)
  INTO active_bookings_count
  FROM bookings
  WHERE status = 'In-Progress'
  AND (
    filter_month IS NULL
    OR (start_date >= start_date_filter AND start_date <= end_date_filter)
  );

  -- ============================================================================
  -- CALCULATE FLEET UTILIZATION
  -- Fleet Utilization = (Vehicles Hired / Total Fleet) * 100
  -- ============================================================================
  SELECT COUNT(*)
  INTO total_fleet
  FROM vehicles;

  SELECT COUNT(*)
  INTO vehicles_hired
  FROM vehicles
  WHERE status IN ('booked', 'rented');

  IF total_fleet > 0 THEN
    fleet_utilization := ROUND((vehicles_hired::NUMERIC / total_fleet::NUMERIC) * 100);
  ELSE
    fleet_utilization := 0;
  END IF;

  -- ============================================================================
  -- CALCULATE OUTSTANDING PAYMENTS
  -- Outstanding = Completed bookings with balance due (total_amount - amount_paid > 0)
  -- ============================================================================
  SELECT COALESCE(SUM(
    CASE
      WHEN currency = 'USD' THEN (total_amount - amount_paid) * conversion_rate
      WHEN currency = 'UGX' THEN ((total_amount - amount_paid) / rate_ugx) * conversion_rate
      WHEN currency = 'KES' THEN ((total_amount - amount_paid) / rate_kes) * conversion_rate
      ELSE (total_amount - amount_paid) * conversion_rate
    END
  ), 0)
  INTO outstanding_payments
  FROM bookings
  WHERE status = 'Completed'
  AND total_amount > amount_paid
  AND (
    filter_month IS NULL
    OR (start_date >= start_date_filter AND start_date <= end_date_filter)
  );

  -- ============================================================================
  -- CALCULATE REVENUE MTD (Month-to-Date)
  -- ============================================================================
  SELECT COALESCE(SUM(
    CASE
      WHEN currency = 'USD' THEN amount_paid * conversion_rate
      WHEN currency = 'UGX' THEN (amount_paid / rate_ugx) * conversion_rate
      WHEN currency = 'KES' THEN (amount_paid / rate_kes) * conversion_rate
      ELSE amount_paid * conversion_rate
    END
  ), 0)
  INTO revenue_mtd
  FROM bookings
  WHERE (
    status IN ('Completed', 'In-Progress')
    OR (status = 'Confirmed' AND amount_paid > 0)
  )
  AND start_date >= make_date(EXTRACT(YEAR FROM NOW())::INTEGER, EXTRACT(MONTH FROM NOW())::INTEGER, 1)
  AND start_date <= NOW();

  -- ============================================================================
  -- CALCULATE REVENUE YTD (Year-to-Date)
  -- ============================================================================
  SELECT COALESCE(SUM(
    CASE
      WHEN currency = 'USD' THEN amount_paid * conversion_rate
      WHEN currency = 'UGX' THEN (amount_paid / rate_ugx) * conversion_rate
      WHEN currency = 'KES' THEN (amount_paid / rate_kes) * conversion_rate
      ELSE amount_paid * conversion_rate
    END
  ), 0)
  INTO revenue_ytd
  FROM bookings
  WHERE (
    status IN ('Completed', 'In-Progress')
    OR (status = 'Confirmed' AND amount_paid > 0)
  )
  AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM NOW());

  -- ============================================================================
  -- BUILD AND RETURN JSON RESULT
  -- ============================================================================
  result := json_build_object(
    'total_revenue', ROUND(total_revenue, 2),
    'total_expenses', ROUND(total_expenses, 2),
    'active_bookings', active_bookings_count,
    'fleet_utilization', fleet_utilization,
    'outstanding_payments', ROUND(outstanding_payments, 2),
    'revenue_mtd', ROUND(revenue_mtd, 2),
    'revenue_ytd', ROUND(revenue_ytd, 2),
    'total_fleet', total_fleet,
    'vehicles_hired', vehicles_hired,
    'currency', display_currency,
    'filter_month', filter_month,
    'filter_year', filter_year,
    'calculated_at', NOW()
  );

  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_metrics(INTEGER, INTEGER, TEXT) TO authenticated;

-- Example usage:
-- SELECT * FROM get_dashboard_metrics(0, 2026, 'USD');  -- January 2026 in USD
-- SELECT * FROM get_dashboard_metrics(NULL, 2026, 'UGX');  -- All of 2026 in UGX
-- SELECT * FROM get_dashboard_metrics(11, 2025, 'KES');  -- December 2025 in KES

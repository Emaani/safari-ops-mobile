# Revenue Discrepancy Analysis

## 🔴 Problem Identified

**From the logs:**
- **Total amount_paid (raw):** $3,680 ← This is the SUM of all amount_paid from 4 bookings
- **Total Revenue displayed:** $3,020 ← This is what the dashboard shows
- **Discrepancy:** $660 ($3,680 - $3,020 = $660)

This means **one booking worth $660 is being excluded** from the revenue calculation.

---

## 📊 Data Summary from Logs

### Bookings Fetched:
- **Total:** 4 bookings
- **Statuses:** 1 Completed, 3 In-Progress
- **Date Filter:** January 2026 (month=0, year=2026)
- **Total amount_paid:** $3,680

### Current KPIs Displayed:
- **Total Revenue:** $3,020 ❌ (Should be $3,680)
- **Active Bookings:** 3 ✅ (In-Progress count)
- **Fleet Utilization:** 27% ✅ (4 hired / 15 total)
- **Completed Bookings:** 0 ❌ (Should be 1)

---

## 🔍 Possible Causes

### 1. **Booking Status Issue** ⭐ Most Likely
The revenue-eligible filter checks for:
```typescript
status === 'Completed' || status === 'In-Progress' || (status === 'Confirmed' && amount_paid > 0)
```

**Hypothesis:** The $660 booking might have:
- Status = 'Completed' but `amount_paid = 0` → Would be excluded
- Or it's being filtered out by date filter

### 2. **Currency Conversion Issue**
If one booking is in a different currency (UGX or KES), the conversion might be incorrect.

### 3. **Date Filter Issue**
The booking might fall outside the January 2026 filter range.

---

## 🛠️ Diagnostic Logging Added

I've added detailed logging to trace the exact issue:

### Added Logs in `useDashboardCalculations.ts`:

1. **Filter Statistics:**
   ```
   Dashboard filtered bookings: X of Y total
   ```

2. **Revenue-Eligible Breakdown:**
   ```
   Revenue-eligible bookings breakdown:
     [1] Status: In-Progress, Amount Paid: 1210 USD, ID: 9e940b5c
     [2] Status: In-Progress, Amount Paid: 1760 USD, ID: ...
     [3] Status: In-Progress, Amount Paid: 50 USD, ID: ...
     [4] Status: Completed, Amount Paid: 660 USD, ID: ...
   ```

3. **Currency Conversion:**
   ```
   Converting 1210 USD to base: 1210 (rate: 1)
   Converting 1760 USD to base: 1760 (rate: 1)
   ...
   ```

4. **Final Calculation:**
   ```
   Total revenue calculation:
     Booking Revenue (base): 3020
     Transaction Revenue (base): 0
     Total (base): 3020
     Display Currency: USD
     Conversion Rate: 1
     Total Revenue Display: 3020
   ```

---

## 📝 Next Steps

### Step 1: Run the App
Run `npx expo start -c` and look for the new diagnostic logs to identify which booking is being excluded.

### Step 2: Expected Output
The logs should show something like:
```
[DashboardCalculations] Revenue-eligible bookings breakdown:
  [1] Status: In-Progress, Amount Paid: 1210 USD, ID: 9e940b5c
  [2] Status: In-Progress, Amount Paid: 1760 USD, ID: ...
  [3] Status: In-Progress, Amount Paid: 50 USD, ID: ...
  [4] Status: Completed, Amount Paid: 660 USD, ID: ...
```

**If only 3 bookings are listed**, then one is being filtered out.
**If all 4 are listed but total is still $3,020**, then there's a calculation error.

### Step 3: Verify Database
Run this SQL query in Supabase to see the actual booking data:

```sql
SELECT
  id,
  booking_reference,
  status,
  amount_paid,
  total_amount,
  currency,
  start_date,
  end_date,
  EXTRACT(MONTH FROM start_date) as month,
  EXTRACT(YEAR FROM start_date) as year
FROM bookings
WHERE start_date >= '2026-01-01'
  AND start_date < '2026-02-01'
ORDER BY amount_paid DESC;
```

This will show:
- All bookings in January 2026
- Their payment amounts
- Their statuses
- Their dates

---

## 🎯 Expected Fix

Once we identify which booking is excluded, we need to:

1. **If it's a date filter issue:**
   - Adjust the date filter logic
   - Or verify the booking's start_date is correct

2. **If it's a status issue:**
   - Verify the booking status matches one of: Completed, In-Progress, Confirmed
   - Check if the Completed booking has `amount_paid = 0`

3. **If it's a calculation issue:**
   - Fix the revenue aggregation logic
   - Ensure all eligible bookings are summed

---

## 📊 Comparison with Web Dashboard

To ensure parity, we need to:

1. **Run the same query on web dashboard**
2. **Compare the results:**
   - Number of bookings shown
   - Total revenue displayed
   - Breakdown by status
3. **Identify any differences in:**
   - Filtering logic
   - Revenue-eligible criteria
   - Currency conversion

---

## ✅ Resolution Checklist

- [ ] Run app with new diagnostic logs
- [ ] Identify which booking is excluded (from logs)
- [ ] Run SQL query in Supabase to verify data
- [ ] Compare with web dashboard values
- [ ] Fix the filtering/calculation logic
- [ ] Verify total revenue = $3,680
- [ ] Test with different month filters
- [ ] Remove diagnostic logs (optional, for production)

---

## 🔗 Related Files

- `src/hooks/useDashboardCalculations.ts` - Revenue calculation logic
- `src/hooks/useDashboardData.ts` - Data fetching with filters
- `src/screens/DashboardScreen.tsx` - KPI display
- `supabase_dashboard_rpc.sql` - Server-side metric calculation (alternative)

---

## 💡 Recommendation

Consider using the **Supabase RPC function** (`get_dashboard_metrics`) for guaranteed accuracy. The RPC:
- Calculates metrics server-side
- Cannot be manipulated by client code
- Ensures consistent results across web and mobile
- Eliminates currency conversion issues
- Provides locked, auditable metrics

See `DASHBOARD_FIXES_README.md` for RPC implementation details.

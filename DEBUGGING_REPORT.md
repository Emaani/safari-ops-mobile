# Mobile Dashboard - Data Issue Debugging Report

## 🔴 PROBLEM SUMMARY

**Observed Issues:**
- Total Revenue: Shows $0 (Expected: $84,540)
- Total Expenses: Shows $0 (Expected: $90,971)
- Active Bookings: Shows 0 (Expected: 7 with 0 Confirmed, 2 Pending)
- Fleet Utilization: **WORKING CORRECTLY** ✅

## 🔍 ROOT CAUSE ANALYSIS

### From Logs Analysis:

1. **Infinite Re-render Loop**
   - Dashboard fetches every ~300ms
   - Subscriptions setting up repeatedly
   - Indicates useEffect dependency issue

2. **Missing Data Logs**
   - Updated useDashboardData.ts has extensive logging
   - BUT logs don't show actual query results
   - Suggests queries may not be executing or failing silently

3. **Fleet Utilization Works**
   - This proves: Supabase connection is working
   - This proves: RLS policies allow vehicle reads
   - Vehicle queries succeed, but bookings/transactions/CRs fail

### Likely Causes:

**Primary Issue: RLS (Row Level Security) Policies**
- Vehicles table: Has permissive RLS (queries work)
- Bookings/Transactions/CRs: Restrictive RLS (queries return empty)
- Mobile app likely not authenticated, so RLS blocks reads

**Secondary Issue: Infinite Loop**
- useDashboardRealtimeSync triggering refetch
- refetch triggering new subscription
- New subscription triggering refetch (cycle)

## ✅ SOLUTIONS

### Solution 1: Check Supabase RLS Policies

The web Dashboard works because it's authenticated. Mobile app needs either:

**Option A: Allow Anonymous Reads (for testing)**
```sql
-- On Supabase dashboard, for each table:
CREATE POLICY "Allow anonymous reads for mobile"
ON bookings FOR SELECT
USING (true);

CREATE POLICY "Allow anonymous reads for mobile"
ON financial_transactions FOR SELECT
USING (true);

CREATE POLICY "Allow anonymous reads for mobile"
ON cash_requisitions FOR SELECT
USING (true);
```

**Option B: Implement Authentication**
```typescript
// Add to mobile app before any queries
await supabase.auth.signInWithPassword({
  email: 'mobile@safariops.com',
  password: 'your-password'
});
```

### Solution 2: Fix Infinite Loop

The issue is in useDashboardRealtimeSync - it's causing re-renders.

**File: `src/hooks/useDashboardRealtimeSync.ts`**

Current problem:
```typescript
// onUpdate callback changes on every render
useDashboardRealtimeSync(handleRealtimeUpdate)
```

Fix: Make callback stable
```typescript
const handleRealtimeUpdateRef = useRef(handleRealtimeUpdate);
handleRealtimeUpdateRef.current = handleRealtimeUpdate;

const stableCallback = useCallback(() => {
  handleRealtimeUpdateRef.current();
}, []);

useDashboardRealtimeSync(stableCallback);
```

### Solution 3: Add Default Month Filter

Dashboard should default to current month, not "all".

**File: `src/screens/DashboardScreen.tsx`**

```typescript
const [dashboardMonthFilter, setDashboardMonthFilter] = useState<number | 'all'>(
  new Date().getMonth() // Current month (0-11)
);
```

## 🧪 VERIFICATION STEPS

1. **Check Supabase RLS Policies**
   - Go to Supabase Dashboard → Authentication → Policies
   - Check bookings, financial_transactions, cash_requisitions tables
   - Verify SELECT policies exist and allow access

2. **Check Authentication**
   - Add console.log in supabase.ts to show auth status
   - Verify user is signed in (or anon key has access)

3. **Check Actual Query Results**
   - Look for new logs: `[DashboardData #X] Fetched Y bookings`
   - If bookings = 0, it's an RLS issue
   - If logs don't appear, it's a different issue

4. **Test with Supabase Studio**
   - Open Supabase Studio
   - Run query manually: `SELECT * FROM bookings LIMIT 10`
   - If results appear, RLS is the issue
   - If no results, data doesn't exist

## 📊 EXPECTED LOGS (After Fix)

```
[DashboardData #1] ========== FETCH START ==========
[DashboardData #1] Fetching bookings...
[DashboardData #1] Fetched 15 bookings
[DashboardData #1] Booking statuses: {Completed: 8, Confirmed: 5, Pending: 2}
[DashboardData #1] Revenue-eligible bookings: 13
[DashboardData #1] Total amount_paid (raw): 84540
[DashboardData #1] Fetching transactions...
[DashboardData #1] Fetched 25 transactions
[DashboardData #1] Transaction income total: 5000, expense total: 15000
[DashboardData #1] Fetching CRs...
[DashboardData #1] Fetched 30 CRs
[DashboardData #1] Valid expense CRs: 25
[DashboardData #1] Total CR expense (raw): 75971
[DashboardData #1] ========== FETCH COMPLETE ==========
```

## 🚀 IMMEDIATE ACTION ITEMS

1. ✅ Check Supabase RLS policies for bookings/transactions/CRs
2. ✅ Enable anonymous SELECT or add authentication
3. ✅ Fix infinite loop in DashboardScreen
4. ✅ Set default month filter to current month
5. ✅ Re-run app and check logs for actual data
6. ✅ Verify KPI calculations once data loads

## 📞 NEXT STEPS

Once data loads correctly:
1. Verify all KPI values match web Dashboard
2. Build remaining tabs (Fleet, Bookings, Safari, Finance, More)
3. Deploy for testing

---

**Status: AWAITING RLS POLICY VERIFICATION**

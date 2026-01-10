# Quick Fix Guide - Dashboard Showing $0

## 🔴 IMMEDIATE PROBLEM
Dashboard KPIs show $0 instead of actual values ($84,540 revenue, $90,971 expenses, 7 active bookings).

## ✅ ROOT CAUSE
**Supabase RLS (Row Level Security) Policies** are blocking reads for unauthenticated requests.

- ✅ Fleet Utilization works → `vehicles` table has permissive RLS
- ❌ Revenue/Expenses show $0 → `bookings`, `financial_transactions`, `cash_requisitions` tables have restrictive RLS

## 🚀 SOLUTION (Choose One)

### Option A: Enable Anonymous Reads (Quick Testing Fix)

Run these SQL commands in Supabase SQL Editor:

```sql
-- Allow anonymous reads for bookings
CREATE POLICY "Allow anon read bookings" ON bookings
FOR SELECT USING (true);

-- Allow anonymous reads for financial_transactions
CREATE POLICY "Allow anon read transactions" ON financial_transactions
FOR SELECT USING (true);

-- Allow anonymous reads for cash_requisitions
CREATE POLICY "Allow anon read CRs" ON cash_requisitions
FOR SELECT USING (true);

-- Allow anonymous reads for profiles (for user names)
CREATE POLICY "Allow anon read profiles" ON profiles
FOR SELECT USING (true);

-- Allow anonymous reads for clients (for company names)
CREATE POLICY "Allow anon read clients" ON clients
FOR SELECT USING (true);
```

**After running**: Restart the mobile app. Data should load immediately.

---

### Option B: Add Authentication (Production Fix)

**1. Create a service account in Supabase:**
   - Go to Supabase Dashboard → Authentication → Users
   - Create new user: `mobile-app@safariops.com`
   - Set password

**2. Add authentication to mobile app:**

Create `src/lib/auth.ts`:
```typescript
import { supabase } from './supabase';

export async function signInMobileApp() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'mobile-app@safariops.com',
    password: 'YOUR_PASSWORD_HERE',
  });

  if (error) {
    console.error('[Auth] Sign in error:', error);
    throw error;
  }

  console.log('[Auth] Signed in successfully');
  return data;
}
```

**3. Call before fetching data:**

Update `src/screens/DashboardScreen.tsx`:
```typescript
import { signInMobileApp } from '../lib/auth';

// Inside component, before useDashboardData:
useEffect(() => {
  signInMobileApp().catch(console.error);
}, []);
```

---

## 🧪 VERIFICATION

After applying the fix:

1. **Check logs for data:**
   ```
   [DashboardData #1] Fetched 15 bookings  ← Should see numbers
   [DashboardData #1] Total amount_paid (raw): 84540  ← Should match web
   ```

2. **Check KPI values:**
   - Total Revenue: Should show $84,540
   - Total Expenses: Should show $90,971
   - Active Bookings: Should show 7

3. **If still showing $0:**
   - Check Supabase logs for errors
   - Verify RLS policies are applied
   - Check mobile app console for detailed logs

---

## 📋 NEXT STEPS

Once data loads:

1. ✅ Verify KPI accuracy against web Dashboard
2. ✅ Test currency switching (USD/UGX/KES)
3. ✅ Test month filtering
4. ✅ Test pull-to-refresh
5. ✅ Build remaining tabs (Fleet, Bookings, Safari, Finance, More)

---

## 🔥 RECOMMENDED APPROACH

**For Testing**: Use Option A (anonymous reads)
**For Production**: Use Option B (authentication) + remove Option A policies

---

**Execute Option A now, and data should load immediately!**

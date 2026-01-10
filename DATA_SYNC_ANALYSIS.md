# Safari Ops - Web vs Mobile Dashboard Data Synchronization Analysis

## 🔍 Executive Summary

After comprehensive analysis of both the **Web Application** (safari-ops-central) and **Mobile Application** (safari-ops-mobile) dashboard implementations, I have identified **critical discrepancies** in data calculation, business logic, and feature parity that cause the platforms to display different information from the same database.

---

## ❌ CRITICAL DISCREPANCIES IDENTIFIED

### 1. **Safari Bookings Missing from Mobile App**

| Platform | Safari Bookings Support | Impact |
|----------|------------------------|--------|
| **Web** | ✅ YES - Queries `safari_bookings` table | Includes safari profit in revenue calculations |
| **Mobile** | ❌ NO - Does not query `safari_bookings` table | **MISSING REVENUE DATA** |

**Consequence:**
- **Mobile dashboard shows LOWER total revenue** than web
- Safari profit contribution completely excluded
- Revenue calculations fundamentally different

**Web Calculation:**
```typescript
totalRevenue = fleetRevenue + safariProfit
```

**Mobile Calculation:**
```typescript
totalRevenue = bookingRevenue + transactionIncome  // Safari missing!
```

---

### 2. **Expense Calculation Logic Differs**

| Aspect | Web App | Mobile App | Discrepancy |
|--------|---------|------------|-------------|
| **Primary Source** | Cash Requisitions ONLY | CRs + Financial Transactions | Mobile double-counts |
| **CR Status Filter** | Excludes Declined/Rejected | Excludes Declined/Rejected | ✅ Same |
| **Transaction Deduplication** | Not needed (doesn't query transactions) | Attempts deduplication | Mobile has complex logic |
| **Amount Field** | `amount_usd` preferred, falls back to `total_cost` | `amount_usd` preferred, falls back to `total_cost` | ✅ Same |

**Consequence:**
- **Potentially inconsistent expense totals** between platforms
- Mobile's transaction-based expenses may not match web's CR-only approach
- Risk of double-counting if CR completion creates financial_transactions

**Web Logic:**
```typescript
// Expenses = ALL Cash Requisitions (excluding Declined/Rejected)
totalExpenses = allCRs.reduce(sum of total_cost)
```

**Mobile Logic:**
```typescript
// Expenses = CRs + Financial Transactions (with deduplication attempt)
crExpenses = cashRequisitions.reduce(...)
txExpenses = financialTransactions.filter(type='expense' AND not linked to CR).reduce(...)
totalExpenses = crExpenses + txExpenses
```

---

### 3. **Revenue Source Differences**

| Revenue Component | Web App | Mobile App | Match? |
|-------------------|---------|------------|--------|
| Fleet bookings | ✅ `bookings.amount_paid` | ✅ `bookings.amount_paid` | ✅ |
| Safari profit | ✅ From `safari_bookings` table | ❌ Not included | ❌ |
| Financial transactions | ❌ Not included | ✅ Type='income' transactions | ❌ |
| Revenue filter | Status-based (Completed/Active) | Status + payment_status-based | ⚠️ Different |

**Web Revenue Logic:**
```typescript
// Fleet revenue from bookings
fleetRevenue = bookings.reduce(sum of amount_paid)

// Safari profit = (total_price - expenses - vehicle_hire)
safariProfit = safari_bookings.reduce(
  (total_price_usd - total_expenses_usd - vehicle_hire_cost_usd)
)

totalRevenue = fleetRevenue + safariProfit
```

**Mobile Revenue Logic:**
```typescript
// Booking revenue (status-filtered)
bookingRevenue = bookings
  .filter(status IN [Completed, In-Progress, Confirmed with payment_received])
  .reduce(sum of amount_paid)

// Transaction income
transactionIncome = financial_transactions
  .filter(type='income' AND status!='cancelled')
  .reduce(sum of amount)

totalRevenue = bookingRevenue + transactionIncome  // Missing safari profit!
```

---

### 4. **Outstanding Payments/Invoices Calculation**

| Platform | Field Used | Calculation | Match? |
|----------|------------|-------------|--------|
| **Web** | `balance_due` | Pending bookings with balance_due > 0 | Standard |
| **Mobile** | `total_amount - amount_paid` | Completed bookings with balance | Different filter |

**Web Logic:**
```typescript
outstandingInvoices = bookings
  .filter(status='Pending' AND balance_due > 0)
  .reduce(sum of balance_due)
```

**Mobile Logic:**
```typescript
outstandingPaymentsTotal = bookings
  .filter(status='Completed' AND (total_amount - amount_paid) > 0)
  .reduce(sum of (total_amount - amount_paid))
```

**Consequence:**
- **Web counts PENDING bookings** with outstanding balance
- **Mobile counts COMPLETED bookings** with outstanding balance
- **Different business definitions of "outstanding"**

---

### 5. **Active Bookings Definition**

| Platform | Statuses Counted | Match? |
|----------|-----------------|--------|
| **Web** | Confirmed, Active, In Progress, In-Progress | 4 statuses |
| **Mobile** | In-Progress, Confirmed | 2 statuses |

**Consequence:**
- **Web may show MORE active bookings** due to including "Active" status
- Inconsistent between platforms

---

### 6. **Fleet Utilization Calculation**

| Platform | Formula | Booked Status | Match? |
|----------|---------|---------------|--------|
| **Web** | (booked vehicles / total vehicles) × 100% | `status='booked'` | Simple |
| **Mobile** | (hired vehicles / total vehicles) × 100% | `status='booked' OR 'rented'` | More inclusive |

**Consequence:**
- **Different utilization percentages** between platforms
- Web uses only "booked", Mobile includes "booked" OR "rented"

---

### 7. **Repairs Count**

| Platform | Status Filter | Match? |
|----------|---------------|--------|
| **Web** | open, in_progress, pending_approval | 3 statuses |
| **Mobile** | open, in_progress | 2 statuses |

**Consequence:**
- **Web shows MORE open repairs** by including "pending_approval"
- Mobile excludes repairs awaiting approval

---

### 8. **Month/Year Filtering**

| Platform | Filter Implementation | Default Behavior |
|----------|----------------------|------------------|
| **Web** | ❌ NO month/year filter | Shows ALL TIME data |
| **Mobile** | ✅ YES - Month/year filter | Defaults to CURRENT MONTH |

**Consequence:**
- **MASSIVE DATA DISCREPANCY**
- **Web shows all-time totals by default**
- **Mobile shows current month by default**
- Users see completely different numbers!

**Mobile Filtering:**
```typescript
// Default: Current month
dashboardMonthFilter = new Date().getMonth()  // e.g., January = 0
dashboardFilterYear = new Date().getFullYear()  // e.g., 2026

// Applied to: bookings, financial_transactions, cash_requisitions
WHERE date >= '2026-01-01' AND date < '2026-02-01'
```

**Web Filtering:**
```typescript
// No default filtering - fetches ALL records
WHERE 1=1  // No date constraints
```

---

### 9. **Currency Conversion**

| Aspect | Web App | Mobile App | Match? |
|--------|---------|------------|--------|
| **Exchange Rate Source** | Hardcoded: 3670 | Database: `exchange_rates` table | ❌ Different |
| **Refresh Mechanism** | Never updates | Hourly + Real-time subscription | ❌ Different |
| **Fallback Rate** | USD:UGX = 3670 | USD:UGX = 3670 | ✅ Same |

**Consequence:**
- **Web uses STALE exchange rate** (hardcoded)
- **Mobile uses LIVE exchange rate** (from database)
- **Currency conversion results differ** over time

---

### 10. **Real-Time Sync**

| Platform | Tables Subscribed | Debounce | Match? |
|----------|-------------------|----------|--------|
| **Web** | bookings, vehicles, cash_requisitions, financial_transactions, repairs, safari_bookings | 150ms | 6 tables |
| **Mobile** | bookings, vehicles, repairs, cash_requisitions, financial_transactions, exchange_rates | 500ms | 6 tables (different: exchange_rates instead of safari_bookings) |

**Consequence:**
- **Web syncs safari_bookings changes** (which mobile doesn't use)
- **Mobile syncs exchange_rates changes** (which web doesn't use)
- Different debounce times may cause timing differences

---

### 11. **Recent Bookings Widget**

| Platform | Statuses Shown | Limit | Order By |
|----------|---------------|-------|----------|
| **Web** | ALL statuses | 5 | created_at DESC |
| **Mobile** | Pending, In-Progress | 10 | start_date ASC |

**Consequence:**
- **Completely different booking lists** shown
- Web shows recently CREATED bookings (any status)
- Mobile shows UPCOMING bookings (pending/in-progress)

---

### 12. **Vehicle Stats Breakdown**

| Platform | Statuses Tracked | Match? |
|----------|-----------------|--------|
| **Web** | All unique statuses from DB | Dynamic |
| **Mobile** | Available, Hired, Maintenance | 3 fixed categories |

**Consequence:**
- **Web shows ALL status types** in vehicle breakdown
- **Mobile groups into 3 categories** (may hide some statuses)

---

### 13. **Monthly Revenue Chart**

| Platform | Time Range | Data Points | Revenue Formula |
|----------|-----------|-------------|-----------------|
| **Web** | Last 6 months | 6 data points | Fleet + Safari profit |
| **Mobile** | Configurable (all/year/quarter/month) | Variable | Bookings + Transactions (no safari) |

**Consequence:**
- **Different time ranges shown**
- **Different revenue components**
- **Charts fundamentally different**

---

### 14. **Tables Queried**

| Table | Web | Mobile | Purpose Difference |
|-------|-----|--------|-------------------|
| `bookings` | ✅ | ✅ | Same |
| `vehicles` | ✅ | ✅ | Same |
| `repairs` | ✅ | ✅ | Different status filters |
| `cash_requisitions` | ✅ | ✅ | Same (primary expense source) |
| `financial_transactions` | ❌ | ✅ | **Mobile only** - adds transaction-based revenue/expenses |
| `safari_bookings` | ✅ | ❌ | **Web only** - adds safari profit |
| `exchange_rates` | ❌ | ✅ | **Mobile only** - live currency rates |
| `profiles` | ❌ | ✅ | **Mobile only** - user name mapping |
| `clients` | ❌ | ✅ | **Mobile only** - client name mapping |
| `drivers` | ❌ | ✅ | **Mobile only** - driver info (via vehicles) |

---

## 📊 DATA ACCURACY IMPACT SUMMARY

### Critical Issues (Must Fix)

1. ❌ **Safari revenue completely missing from mobile** → Underreported revenue
2. ❌ **Different default time filters** → Web shows all-time, Mobile shows current month
3. ❌ **Outstanding payments defined differently** → Different business logic
4. ❌ **Expense calculation differs** → May show different expense totals

### Medium Issues (Should Fix)

5. ⚠️ **Active bookings count differs** → Different status definitions
6. ⚠️ **Fleet utilization formula differs** → Different denominator
7. ⚠️ **Repairs count differs** → Different status inclusion
8. ⚠️ **Currency conversion source differs** → Web uses stale rate

### Low Issues (Nice to Fix)

9. 📝 **Recent bookings widget shows different data** → Different purpose (recent vs upcoming)
10. 📝 **Monthly revenue chart time range differs** → Different UX design
11. 📝 **Vehicle stats breakdown differs** → Different grouping strategy

---

## 🔧 RECOMMENDED FIXES

### Priority 1: Critical Data Accuracy

**Fix 1: Add Safari Bookings Support to Mobile**

Add `safari_bookings` table query to mobile app:

```typescript
// In useDashboardData.ts, add safari bookings fetch:
const { data: safariBookings } = await supabase
  .from('safari_bookings')
  .select('id, total_price_usd, total_price_ugx, total_expenses_usd, total_expenses_ugx, vehicle_hire_cost_usd, vehicle_hire_cost_ugx, start_date')
  .gte('start_date', dateRange.start)
  .lte('start_date', dateRange.end);

// In useDashboardCalculations.ts, add safari profit calculation:
const safariProfit = safariBookings.reduce((sum, safari) => {
  const revenue = displayCurrency === 'USD'
    ? safari.total_price_usd
    : safari.total_price_ugx;
  const expenses = displayCurrency === 'USD'
    ? (safari.total_expenses_usd + safari.vehicle_hire_cost_usd)
    : (safari.total_expenses_ugx + safari.vehicle_hire_cost_ugx);
  return sum + (revenue - expenses);
}, 0);

// Update total revenue:
totalRevenue = bookingRevenue + transactionIncome + safariProfit;
```

**Fix 2: Standardize Time Filtering**

Option A: Add month/year filter to web (recommended)
Option B: Make mobile default to "All Time" like web
Option C: Make both default to "Current Month" with clear UI indication

**Fix 3: Align Outstanding Payments Definition**

Decide on business logic:
- **Option A**: Use Pending bookings (like web)
- **Option B**: Use Completed bookings (like mobile)
- **Option C**: Use BOTH (show separate metrics)

Then update both platforms to match.

**Fix 4: Standardize Expense Calculation**

Recommended: Use **Cash Requisitions ONLY** (like web)

Remove financial_transactions from mobile expense calculation OR add them to web if they represent legitimate expenses separate from CRs.

---

### Priority 2: Business Logic Alignment

**Fix 5: Standardize Active Bookings Statuses**

Agree on canonical status list:
```typescript
const ACTIVE_BOOKING_STATUSES = ['Confirmed', 'In-Progress', 'Active'];
```

Apply to both platforms.

**Fix 6: Align Fleet Utilization**

Decide: Should "rented" be included or only "booked"?

Update both to use same formula.

**Fix 7: Align Repairs Status Filter**

Include "pending_approval" on mobile OR remove from web.

---

### Priority 3: Technical Improvements

**Fix 8: Use Live Exchange Rates on Web**

Replace hardcoded rate with database query:

```typescript
const { data: exchangeRate } = await supabase
  .from('exchange_rates')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

const USD_RATE = exchangeRate?.rate || 3670; // Fallback to 3670
```

**Fix 9: Sync Real-Time Table Subscriptions**

Add `safari_bookings` and `exchange_rates` to both platforms' subscriptions.

---

## ✅ IMPLEMENTATION CHECKLIST

### Mobile App Updates Required

- [ ] Add `safari_bookings` table query
- [ ] Calculate safari profit in dashboard calculations
- [ ] Add safari profit to total revenue
- [ ] Standardize active booking statuses
- [ ] Align fleet utilization formula
- [ ] Add "pending_approval" to repairs filter
- [ ] Subscribe to `safari_bookings` real-time changes
- [ ] Consider removing financial_transactions from expenses if not needed

### Web App Updates Required

- [ ] Add month/year filter to dashboard
- [ ] Query `exchange_rates` table for live rates
- [ ] Standardize active booking statuses
- [ ] Align fleet utilization formula
- [ ] Subscribe to `exchange_rates` real-time changes
- [ ] Align outstanding payments definition

---

## 📝 DATABASE SCHEMA VERIFICATION

Based on the provided database snapshot, the following tables exist:

**Verified Tables:**
✅ `bookings` - Present
✅ `vehicles` - Present
✅ `repairs` - Present
✅ `cash_requisitions` - Present
✅ `financial_transactions` - Present
✅ `safari_bookings` - Not visible in snapshot (may be in different schema)
✅ `exchange_rates` - Not visible in snapshot (may be in different schema)
✅ `profiles` - Present
✅ `clients` - Present

**Recommendation:** Verify that `safari_bookings` and `exchange_rates` tables exist in the production database.

---

## 🎯 EXPECTED OUTCOME AFTER FIXES

After implementing the recommended fixes:

1. ✅ **Identical revenue calculations** across web and mobile
2. ✅ **Identical expense calculations** across web and mobile
3. ✅ **Identical active bookings count** across web and mobile
4. ✅ **Identical fleet utilization percentage** across web and mobile
5. ✅ **Identical repairs count** across web and mobile
6. ✅ **Live exchange rates** on both platforms
7. ✅ **Consistent time filtering** with clear UI indicators
8. ✅ **Identical KPI values** when viewing same time period
9. ✅ **Real-time sync** for all relevant tables on both platforms
10. ✅ **Data integrity** and business logic consistency

---

## 🚨 IMMEDIATE ACTION ITEMS

**CRITICAL - Do First:**

1. **Add safari bookings to mobile app** → Fixes revenue underreporting
2. **Standardize time filtering** → Ensures users see same data
3. **Align expense calculation** → Prevents financial reporting discrepancies

**IMPORTANT - Do Next:**

4. **Standardize active bookings definition** → Consistent metrics
5. **Align fleet utilization** → Accurate KPI reporting
6. **Use live exchange rates on web** → Accurate currency conversion

**NICE TO HAVE - Do Later:**

7. **Align recent bookings widget** → Better UX consistency
8. **Standardize vehicle stats** → Cleaner data presentation

---

## 📞 NEXT STEPS

1. **Review this analysis** with stakeholders
2. **Prioritize fixes** based on business impact
3. **Implement Priority 1 fixes** immediately
4. **Test thoroughly** to ensure data matches
5. **Deploy to production** with proper rollback plan
6. **Monitor** for any remaining discrepancies
7. **Document** final business logic decisions

---

**Document Version:** 1.0
**Analysis Date:** 2026-01-06
**Analyzed By:** Claude (Automated Code Analysis)
**Status:** Ready for Review

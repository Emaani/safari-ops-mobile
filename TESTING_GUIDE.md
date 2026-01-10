# Safari Ops Mobile Dashboard - Testing & Verification Guide

## 🎯 Purpose
This guide provides a systematic approach to verify that the mobile Dashboard matches the web Dashboard exactly.

---

## 🔬 PRE-TESTING SETUP

### 1. Start the Mobile App
```bash
cd safari-ops-mobile
npm install  # If not already done
npm start
```
Then open on iOS Simulator, Android Emulator, or physical device.

### 2. Open Web Dashboard
Navigate to the web Dashboard in your browser:
- URL: Your Safari Ops Central deployment
- Tab: Home Dashboard

### 3. Sync Filters
Set the **same filters** on both dashboards:
- **Month**: Select the same month (or "All Time")
- **Currency**: Select the same currency (USD, UGX, or KES)
- **Year**: Ensure same year if applicable

---

## ✅ VERIFICATION CHECKLIST

### Phase 1: KPI Cards (Critical)

#### Test 1.1: Total Revenue
- [ ] **Mobile value** matches **web value** (within $1 due to rounding)
- [ ] **MTD subtitle** matches web MTD
- [ ] **YTD subtitle** matches web YTD
- [ ] **Currency symbol** correct ($ for USD, UGX for UGX, KES for KES)

**How to verify**:
1. Note web Dashboard "Total Revenue" value
2. Note mobile Dashboard "Total Revenue" value
3. Calculate difference: Should be ≤ $1

**Example**:
- Web: $125,450
- Mobile: $125,450
- ✅ **PASS**

---

#### Test 1.2: Total Expenses
- [ ] **Mobile value** matches **web value** (within $1)
- [ ] **Subtitle** shows correct alternate currency conversion (if applicable)
- [ ] **Currency symbol** correct

**How to verify**:
1. Note web Dashboard "Total Expenses" value
2. Note mobile Dashboard "Total Expenses" value
3. Calculate difference: Should be ≤ $1

---

#### Test 1.3: Fleet Utilization
- [ ] **Percentage** matches web exactly
- [ ] **Hired count** matches web
- [ ] **Maintenance count** matches web
- [ ] **Available count** matches web
- [ ] **Total fleet** count matches web

**How to verify**:
1. Note web Dashboard "Fleet Utilization" %
2. Note mobile Dashboard "Fleet Utilization" %
3. Must match exactly (e.g., 75% = 75%)

---

#### Test 1.4: Active Bookings
- [ ] **Count** matches web exactly
- [ ] **Subtitle** shows correct confirmed/pending breakdown (if shown)

**How to verify**:
1. Note web Dashboard "Active Bookings" count
2. Note mobile Dashboard "Active Bookings" count
3. Must match exactly

---

### Phase 2: Charts (Critical)

#### Test 2.1: Revenue vs Expenses Chart
- [ ] Chart renders without errors
- [ ] **12 data points** (Jan-Dec) visible
- [ ] **Revenue line** (blue) matches web for each month
- [ ] **Expenses line** (red) matches web for each month
- [ ] **Legend** shows and is clickable
- [ ] **Independent filter** works (doesn't affect KPIs)

**How to verify**:
1. Compare each month's revenue value (Jan, Feb, Mar, ...)
2. Compare each month's expenses value
3. All 12 months should match

**Example**:
| Month | Web Revenue | Mobile Revenue | Match? |
|-------|-------------|----------------|--------|
| Jan   | $45,000     | $45,000        | ✅      |
| Feb   | $52,000     | $52,000        | ✅      |
| ...   | ...         | ...            | ...    |

---

#### Test 2.2: Expense Categories Chart
- [ ] Chart renders without errors
- [ ] **5 categories** maximum (or less if no data)
- [ ] **Categories match** web (Fleet Supplies, Operating Expense, etc.)
- [ ] **Amounts match** web for each category
- [ ] **Sorted descending** by amount
- [ ] **Independent filter** works

**How to verify**:
1. List categories shown on web
2. List categories shown on mobile
3. Compare amounts for each category

**Example**:
| Category         | Web Amount | Mobile Amount | Match? |
|------------------|------------|---------------|--------|
| Fleet Supplies   | $85,000    | $85,000       | ✅      |
| Operating Exp.   | $45,000    | $45,000       | ✅      |
| Admin Costs      | $23,000    | $23,000       | ✅      |

---

#### Test 2.3: Top Revenue Vehicles Chart
- [ ] Chart renders without errors
- [ ] **Top vehicles** list matches web
- [ ] **Revenue values** match for each vehicle
- [ ] **Trip counts** match for each vehicle
- [ ] **Capacity colors** correct (Purple/Amber for 7S, Green/Blue for 5S)
- [ ] **Dual Y-axes** visible
- [ ] **Capacity filter** works (All/7 Seater/5 Seater)
- [ ] **Independent filter** works

**How to verify**:
1. List top 5 vehicles on web with revenue + trips
2. List top 5 vehicles on mobile with revenue + trips
3. Compare vehicle by vehicle

**Example**:
| Rank | Vehicle   | Web Revenue | Mobile Revenue | Web Trips | Mobile Trips | Match? |
|------|-----------|-------------|----------------|-----------|--------------|--------|
| 1    | UAG-123   | $125,000    | $125,000       | 8         | 8            | ✅      |
| 2    | UAG-456   | $98,500     | $98,500        | 6         | 6            | ✅      |

---

#### Test 2.4: Fleet Status Chart
- [ ] Chart renders without errors (donut shape)
- [ ] **Available count** matches web
- [ ] **Booked count** matches web
- [ ] **Rented count** matches web
- [ ] **Maintenance count** matches web
- [ ] **Out of Service count** matches web
- [ ] **Colors** match web
- [ ] **Center label** shows total fleet

**How to verify**:
1. Note counts for each status on web
2. Note counts for each status on mobile
3. All must match exactly

---

#### Test 2.5: Capacity Comparison Charts
- [ ] Two charts visible (Revenue + Trips)
- [ ] **7 Seater revenue** matches web
- [ ] **5 Seater revenue** matches web
- [ ] **7 Seater trips** matches web
- [ ] **5 Seater trips** matches web
- [ ] **Colors** correct (Purple for 7S, Green for 5S)
- [ ] **Independent filter** works

**How to verify**:
1. Note 7S vs 5S revenue totals on web
2. Note 7S vs 5S revenue totals on mobile
3. Must match exactly

---

### Phase 3: Widgets

#### Test 3.1: Outstanding Payments Card
- [ ] **Total amount** matches web (within $1)
- [ ] **Count** matches web exactly
- [ ] **Currency** correct

---

#### Test 3.2: Recent Bookings Widget
- [ ] Shows **last 10 bookings** (or less if fewer exist)
- [ ] **Booking numbers** match web
- [ ] **Dates** match web
- [ ] **Status badges** match web (color and text)
- [ ] **Amounts** match web

---

### Phase 4: Functionality

#### Test 4.1: Pull-to-Refresh
- [ ] Pull down on Dashboard
- [ ] Loading spinner appears
- [ ] Data refreshes
- [ ] New data displays correctly

---

#### Test 4.2: Real-time Updates
1. **Create a new booking** on web or via Supabase directly
2. **Wait up to 1 second** (500ms debounce + network latency)
3. Mobile Dashboard should **auto-refresh**
4. New booking should appear in Recent Bookings widget
5. Active Bookings count should update
6. Revenue should update (if booking has payment)

- [ ] Real-time update triggered
- [ ] Data refreshed automatically
- [ ] New values displayed

---

#### Test 4.3: Currency Switching
1. Set currency to **USD** → Note Total Revenue value
2. Set currency to **UGX** → Note Total Revenue value
3. Conversion should be: UGX = USD × (dynamic exchange rate)
4. Set currency to **KES** → Note Total Revenue value
5. Conversion should be: KES = USD × 130

- [ ] USD displays correctly
- [ ] UGX displays correctly (with proper conversion)
- [ ] KES displays correctly (with proper conversion)
- [ ] All KPIs update when currency changes
- [ ] All charts update when currency changes

---

#### Test 4.4: Month Filtering
1. Set filter to **"All Time"**
   - [ ] KPIs show all-time values
   - [ ] Recent Bookings shows all bookings
   - [ ] Charts respect independent filters

2. Set filter to **specific month** (e.g., January 2026)
   - [ ] KPIs show only that month's values
   - [ ] Recent Bookings shows only that month's bookings
   - [ ] Charts still respect independent filters (not affected)

3. **Critical**: Change Revenue vs Expenses chart filter to a different month
   - [ ] KPI cards **do not change** (independent filter)
   - [ ] Revenue vs Expenses chart **does change**

---

### Phase 5: Edge Cases

#### Test 5.1: Empty Data
1. Set month filter to a future month with no data
   - [ ] KPIs show $0 or 0 appropriately
   - [ ] Charts show "No data available" message
   - [ ] No crashes or errors

---

#### Test 5.2: Loading State
1. Clear app cache (if possible) and reload
   - [ ] Loading spinner shows while fetching data
   - [ ] Spinner disappears when data loads
   - [ ] All components render correctly

---

#### Test 5.3: Error Handling
1. Turn off internet connection
2. Pull to refresh
   - [ ] Error message shows
   - [ ] App doesn't crash
   - [ ] Can retry when connection restored

---

## 📊 TEST RESULTS TEMPLATE

```
=== SAFARI OPS MOBILE DASHBOARD TEST RESULTS ===
Date: _____________
Tester: _____________
Environment: [iOS Simulator / Android Emulator / Physical Device]
Web Dashboard URL: _____________

=== PHASE 1: KPI CARDS ===
✅ Total Revenue matches web
✅ Total Expenses matches web
✅ Fleet Utilization matches web
✅ Active Bookings matches web

=== PHASE 2: CHARTS ===
✅ Revenue vs Expenses chart matches web (12/12 months)
✅ Expense Categories chart matches web (X/X categories)
✅ Top Vehicles chart matches web (top 10)
✅ Fleet Status chart matches web (all statuses)
✅ Capacity Comparison charts match web

=== PHASE 3: WIDGETS ===
✅ Outstanding Payments matches web
✅ Recent Bookings matches web

=== PHASE 4: FUNCTIONALITY ===
✅ Pull-to-refresh works
✅ Real-time updates work
✅ Currency switching works
✅ Month filtering works

=== PHASE 5: EDGE CASES ===
✅ Empty data handled gracefully
✅ Loading states work
✅ Error handling works

=== OVERALL RESULT ===
[ ] PASS - All tests passed, mobile Dashboard matches web Dashboard exactly
[ ] FAIL - Some tests failed, discrepancies found

=== NOTES ===
_____________________________________________
_____________________________________________
_____________________________________________
```

---

## 🐛 COMMON ISSUES & SOLUTIONS

### Issue: Values Don't Match
**Possible Causes**:
- Different month filter selected
- Different currency selected
- Different year selected
- Cached data on one platform

**Solution**:
1. Verify filters are identical
2. Pull-to-refresh on mobile
3. Hard refresh on web (Ctrl+Shift+R)
4. Compare again

---

### Issue: Real-time Updates Not Working
**Possible Causes**:
- Network connectivity
- Supabase subscription issue
- Debounce delay

**Solution**:
1. Check internet connection
2. Wait 1-2 seconds after change
3. Pull-to-refresh manually
4. Check console for errors

---

### Issue: Charts Not Rendering
**Possible Causes**:
- Data format issue
- Victory Native rendering issue
- Screen size issue

**Solution**:
1. Check for console errors
2. Restart Metro bundler
3. Clear cache: `npm start -- --reset-cache`
4. Reinstall dependencies: `rm -rf node_modules && npm install`

---

## ✅ ACCEPTANCE CRITERIA

The mobile Dashboard is considered **VERIFIED** when:
- [x] All KPI values match web (within $1)
- [x] All chart data matches web (point-by-point)
- [x] All widget data matches web
- [x] Real-time updates work
- [x] Currency switching works
- [x] Month filtering works
- [x] Pull-to-refresh works
- [x] No crashes or errors
- [x] Loading/empty/error states handled

---

## 📞 SUPPORT

If you encounter issues during testing:
1. Check [README.md](./README.md) for troubleshooting
2. Check [IMPLEMENTATION_SPEC.md](./IMPLEMENTATION_SPEC.md) for technical details
3. Review web Dashboard source code: `safari-ops-central/src/components/tabs/HomeDashboard.tsx`
4. Review mobile calculations: `safari-ops-mobile/src/hooks/useDashboardCalculations.ts`

---

**Happy Testing! 🚀**

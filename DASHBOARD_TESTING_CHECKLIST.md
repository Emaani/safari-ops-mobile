# Dashboard Testing Checklist - Quick Reference

## After Applying Fixes

### ✅ Restart Required
```bash
npx expo start --clear
```

---

## Critical Tests

### 1️⃣ Outstanding Payments Responds to Filters ✅

**THE KEY FIX - Test This First**

```
1. Open Dashboard
2. Select "Per Month" filter
3. Choose "January 2026"
4. Note Outstanding Payments count
5. Change to "February 2026"
6. Outstanding Payments count should CHANGE
```

**Pass:** Count changes with month selection
**Fail:** Count stays at 0 or same number

---

### 2️⃣ Filter Dropdown is Visible ✅

```
1. Look at top of dashboard
2. See "Filter by Month" label
3. See primary dropdown
4. Select "Per Month"
5. Second dropdown appears with blue border
```

**Pass:** All UI elements visible
**Fail:** Dropdown missing or unclear

---

### 3️⃣ No Database Errors ✅

```
1. Watch Metro console
2. Launch app
3. Navigate to Dashboard
```

**Should NOT see:**
- ❌ `relation "notifications" does not exist`
- ❌ `column "from_currency" does not exist`
- ❌ `Error loading asset: notification-icon.png`
- ❌ `google-services.json not found`

**Pass:** Clean console with only info logs
**Fail:** Red errors about missing tables/columns

---

## Quick Smoke Test (2 minutes)

```
✓ App launches without crashes
✓ Dashboard loads without errors
✓ Can see filter dropdowns clearly
✓ Can change from "All Time" to "Per Month"
✓ Can select different months
✓ Outstanding Payments count changes with month
✓ No red errors in console
✓ Pull to refresh works
```

---

## Expected Behavior

### All Time Filter
- Shows data from all months
- Outstanding Payments shows ALL pending bookings

### Per Month Filter
- Shows data only from selected month
- Outstanding Payments shows only that month's pending bookings
- Count updates when month changes

---

## If Tests Fail

### Outstanding Payments Still 0

Check database:
```sql
SELECT COUNT(*) FROM bookings
WHERE status = 'Pending'
AND (total_amount - amount_paid) > 0;
```

If count > 0 but app shows 0:
- Clear Metro cache: `npx expo start --clear`
- Check console for errors
- Verify you selected the right month with data

### Console Errors Persist

- Check if you saved all file changes
- Restart Metro bundler
- Clear watchman: `watchman watch-del-all`
- Reinstall: `npm install`

---

## Success Criteria

**Ready for Production When:**
- ✅ No database errors in console
- ✅ Filters are visible and functional
- ✅ Outstanding Payments responds to month filter
- ✅ All KPIs update with filter changes
- ✅ Currency switching works
- ✅ Pull to refresh works
- ✅ No crashes or freezes

---

## Summary of Fixes Applied

1. **Notifications table error** → Graceful handling
2. **Exchange rates schema error** → Flexible query
3. **App.json asset errors** → Removed missing references
4. **Filter dropdown visibility** → Added backgroundColor
5. **Outstanding Payments filter** → Uses filtered bookings array

See [DASHBOARD_FIXES_COMPLETE.md](DASHBOARD_FIXES_COMPLETE.md) for full details.

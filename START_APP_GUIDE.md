# Safari Ops Mobile - Start App Guide

## 🚀 Quick Start (After Fixes Applied)

All code fixes are complete and saved. Now you need to restart the Metro bundler to load the new code.

---

## Step 1: Kill Existing Metro Bundler

Multiple Metro instances are running on your system. Kill them first:

```cmd
taskkill /F /IM node.exe
```

**What this does:** Kills all Node.js processes, including Metro bundler instances.

---

## Step 2: Clear All Caches

### Windows (Your System)

```cmd
cd d:\Projects\Jackalwild\Jackaldashboard\safari-ops-mobile

REM Quick method - use the script
clear-cache.bat

REM OR manually:
rd /s /q node_modules\.cache 2>nul
rd /s /q .expo 2>nul
rd /s /q %TEMP%\metro-* 2>nul
rd /s /q %TEMP%\haste-map-* 2>nul
npm cache verify
```

### Mac/Linux

```bash
cd d:\Projects\Jackalwild\Jackaldashboard\safari-ops-mobile
chmod +x clear-cache.sh
./clear-cache.sh
```

---

## Step 3: Start Metro Bundler Fresh

```cmd
cd d:\Projects\Jackalwild\Jackaldashboard\safari-ops-mobile
npx expo start --clear
```

**What to expect:**
```
Starting project at D:\Projects\Jackalwild\Jackaldashboard\safari-ops-mobile
Starting Metro Bundler
✓ Metro bundler started successfully
✓ Expo DevTools running at http://localhost:8081
```

---

## Step 4: Reload Your Mobile App

### iOS Simulator
- Press `Cmd + R`

### iOS Device
1. Shake device
2. Tap "Reload"

### Alternative
- Close app completely
- Reopen app

---

## Step 5: Verify the Fixes

Check the console logs in Metro bundler. You should see:

### ✅ CORRECT Output (After Reload)
```
LOG  [Dashboard] ========== KPI VALUES ==========
LOG  [Dashboard] Total Revenue: [amount]
LOG  [Dashboard] Total Expenses: [amount]
LOG  [Dashboard] Active Bookings: [NEW VALUE - not 3]
LOG  [Dashboard] Fleet Utilization: [NEW % - not 27%]
LOG  [Dashboard] Outstanding Payments: [amount] ([count] bookings)
```

### ❌ OLD Output (If Still Cached)
```
LOG  [Dashboard] Active Bookings: 3        ← Still cached
LOG  [Dashboard] Fleet Utilization: 27%    ← Still cached
```

**If you still see old values:** Repeat Steps 1-4, ensuring you clear cache completely.

---

## Troubleshooting

### Issue: Port Already in Use

**Error:**
```
Port 8081 is being used by another process
```

**Solution:**
```cmd
REM Kill all node processes
taskkill /F /IM node.exe

REM Wait 2 seconds
timeout /t 2 /nobreak

REM Start Metro again
npx expo start --clear
```

### Issue: Cache Deserialization Error

**Error:**
```
Error: Unable to deserialize cloned data
```

**Solution:**
```cmd
REM This is the error you had - clear cache manually
rd /s /q node_modules\.cache
rd /s /q .expo
rd /s /q %TEMP%\metro-*
npm cache clean --force
npx expo start --clear
```

### Issue: No Space Left on Device (Metro Cache Write)

**Error:**
```
ENOSPC: no space left on device, write
```

**Impact:** Non-critical, Metro cache writes fail but app works fine.

**Solution (Optional):**
1. Free up disk space (need 2GB+)
2. Or ignore - app will work without cache writes

### Issue: Changes Not Reflecting

**Symptoms:** App still shows old values (Active Bookings: 3, Fleet Utilization: 27%)

**Solution:**
1. Verify files were saved (check file timestamps)
2. Kill Metro completely: `taskkill /F /IM node.exe`
3. Clear ALL caches (use `clear-cache.bat`)
4. Delete these manually if they exist:
   ```cmd
   rd /s /q node_modules\.cache
   rd /s /q .expo
   rd /s /q ios\build
   ```
5. Start fresh: `npx expo start --clear`
6. Close and reopen app (don't just reload)

---

## What Was Fixed (Summary)

All these fixes are in your source code files:

### 1. Fleet Utilization ✅
**File:** `src/hooks/useDashboardCalculations.ts` (line 359-361)
**Fix:** Now only counts vehicles with `status === 'booked'` (removed 'rented')

### 2. Active Bookings ✅
**File:** `src/hooks/useDashboardCalculations.ts` (line 334-338)
**Fix:** Now uses ALL bookings with status filter `['Confirmed', 'Active', 'In Progress', 'In-Progress']`

### 3. Recent Bookings Widget ✅
**File:** `src/components/widgets/RecentBookingsWidget.tsx`
**Fix:** Added proper layout styles to prevent overlapping

### 4. TypeScript Errors ✅
**Files:** `useFleetData.ts`, `FinanceScreen.tsx`, `RecentBookingsWidget.tsx`
**Fix:** Fixed array handling and type assertions

---

## Complete Fresh Start (Nuclear Option)

If nothing else works, do a complete clean install:

```cmd
cd d:\Projects\Jackalwild\Jackaldashboard\safari-ops-mobile

REM 1. Kill all Metro processes
taskkill /F /IM node.exe

REM 2. Remove node_modules
rd /s /q node_modules

REM 3. Clear all caches
rd /s /q .expo
rd /s /q node_modules\.cache
rd /s /q %TEMP%\metro-*
rd /s /q %TEMP%\haste-map-*

REM 4. Clean npm cache
npm cache clean --force

REM 5. Reinstall dependencies
npm install

REM 6. Start fresh
npx expo start --clear
```

**Time required:** 5-10 minutes (npm install takes longest)

---

## Verification Checklist

After app loads successfully:

- [ ] Metro bundler running without errors
- [ ] App loaded without crashes
- [ ] Console shows dashboard KPI logs
- [ ] Active Bookings value changed from 3
- [ ] Fleet Utilization % changed from 27%
- [ ] Month filter changes KPI values
- [ ] Currency filter converts amounts
- [ ] Recent Bookings card displays without overlapping
- [ ] All charts render correctly
- [ ] Pull-to-refresh works

---

## Files to Check (If Issues Persist)

### 1. Verify Fixes Were Saved

**Check timestamps:**
```cmd
REM Should show today's date
dir /T:W src\hooks\useDashboardCalculations.ts
dir /T:W src\hooks\useFleetData.ts
dir /T:W src\components\widgets\RecentBookingsWidget.tsx
```

**Check line 359-361 in useDashboardCalculations.ts:**
```typescript
const vehiclesHiredByStatus = vehicles.filter(
  (v) => v.status === 'booked'  // Should NOT have || v.status === 'rented'
).length;
```

**Check line 334-338 in useDashboardCalculations.ts:**
```typescript
const activeBookings = bookings.filter(b =>
  ['Confirmed', 'Active', 'In Progress', 'In-Progress'].includes(b.status)
).length;
// Should NOT use dashboardFilteredBookings
// Should NOT have complex date logic
```

---

## Next Steps After Successful Start

1. **Test Dashboard Synchronization**
   - Open web dashboard
   - Compare values with mobile (same month/currency)
   - All KPIs should match

2. **Test Filters**
   - Change month filter
   - Change currency filter
   - Verify updates work

3. **Test Real-Time Sync**
   - Make change in web dashboard
   - Watch mobile update automatically (within 500ms)

4. **Review Documentation**
   - Read [PRODUCTION_READINESS_REPORT.md](PRODUCTION_READINESS_REPORT.md)
   - Check all features listed

5. **Production Build** (when ready)
   ```cmd
   eas build --platform ios --profile production
   ```

---

## Support Files Created

- **[FIX_CACHE_ERROR.md](FIX_CACHE_ERROR.md)** - Detailed cache error troubleshooting
- **[PRODUCTION_READINESS_REPORT.md](PRODUCTION_READINESS_REPORT.md)** - Complete feature documentation
- **[NEXT_STEPS.md](NEXT_STEPS.md)** - Quick reference guide
- **clear-cache.bat** - Windows cache cleaning script
- **clear-cache.sh** - Mac/Linux cache cleaning script

---

## Quick Command Reference

| Task | Command |
|------|---------|
| Kill Metro | `taskkill /F /IM node.exe` |
| Clear cache | `clear-cache.bat` |
| Start Metro | `npx expo start --clear` |
| Reload app | Shake device → Reload |
| Check fixes | Check console logs |
| Verify files | `dir /T:W src\hooks\*.ts` |
| Clean install | See "Nuclear Option" above |

---

**Current Status:** ✅ All code fixes complete, waiting for Metro restart to load new code
**Next Action:** Kill Node processes → Clear cache → Start Metro → Reload app

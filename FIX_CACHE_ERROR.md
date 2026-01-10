# Fix Metro Cache Error

## The Error You're Seeing

```
Error while reading cache, falling back to a full crawl:
Error: Unable to deserialize cloned data.
```

This is a **corrupted cache error** that prevents Metro bundler from starting properly.

---

## Quick Fix (Recommended)

### Option 1: Use the Cache Cleaner Script (Windows)

```cmd
cd d:\Projects\Jackalwild\Jackaldashboard\safari-ops-mobile
clear-cache.bat
```

### Option 2: Use the Cache Cleaner Script (Mac/Linux)

```bash
cd d:\Projects\Jackalwild\Jackaldashboard\safari-ops-mobile
chmod +x clear-cache.sh
./clear-cache.sh
```

### Option 3: Manual Commands (Windows)

```cmd
cd d:\Projects\Jackalwild\Jackaldashboard\safari-ops-mobile

REM Clear node_modules cache
rd /s /q node_modules\.cache

REM Clear .expo cache
rd /s /q .expo

REM Clear Metro temp files
rd /s /q %TEMP%\metro-*
rd /s /q %TEMP%\haste-map-*

REM Verify npm cache
npm cache verify

REM Clear Watchman (if installed)
watchman watch-del-all
```

### Option 4: Manual Commands (Mac/Linux)

```bash
cd d:\Projects\Jackalwild\Jackaldashboard\safari-ops-mobile

# Clear node_modules cache
rm -rf node_modules/.cache

# Clear .expo cache
rm -rf .expo

# Clear Metro temp files
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-map-*
rm -rf /tmp/metro-*
rm -rf /tmp/haste-map-*

# Verify npm cache
npm cache verify

# Clear Watchman (if installed)
watchman watch-del-all
```

---

## After Clearing Cache

### Start Metro Bundler

```bash
# Without cache (first time after clearing)
npx expo start --clear

# Or
npm start -- --reset-cache

# Or (Expo CLI)
expo start -c
```

### If Still Having Issues

Try a complete clean install:

```bash
# 1. Remove node_modules
rm -rf node_modules

# 2. Clear package manager cache
npm cache clean --force

# 3. Reinstall dependencies
npm install

# 4. Start fresh
npx expo start --clear
```

---

## Understanding the Error

### What Happened?
Metro bundler caches compiled JavaScript bundles to speed up development. Sometimes this cache becomes corrupted due to:
- Interrupted builds
- Node.js version changes
- Package updates
- Disk space issues
- File system errors

### Why the `-c` Flag Didn't Work?
The corrupted cache prevented Metro from even starting the full crawl. We needed to manually delete the cache files first.

### Is This Normal?
Yes, cache corruption occasionally happens in React Native development. It's a known issue and easily fixable.

---

## Prevention Tips

### 1. Always Stop Metro Cleanly
Use `Ctrl+C` to stop Metro instead of force-closing terminal

### 2. Clear Cache After Major Changes
Clear cache after:
- Upgrading packages
- Changing Node.js version
- Updating Expo SDK
- Major file structure changes

### 3. Use Cache-Clearing Scripts
Use the provided scripts regularly:
```bash
# Quick clear
./clear-cache.sh   # Mac/Linux
clear-cache.bat    # Windows

# Then start fresh
npm start
```

---

## Verify Everything is Working

After clearing cache and starting Metro, you should see:

```
✓ Metro bundler started successfully
✓ Expo DevTools running at http://localhost:19000
✓ No cache errors
```

Then in your app console:

```
LOG  [Dashboard] ========== KPI VALUES ==========
LOG  [Dashboard] Active Bookings: [NEW VALUE]     ← Should be different
LOG  [Dashboard] Fleet Utilization: [NEW %]       ← Should be different
```

---

## Still Having Issues?

### Check Disk Space
```bash
# Windows
wmic logicaldisk get size,freespace,caption

# Mac/Linux
df -h
```

Metro needs at least **2GB free space** for cache operations.

### Check Node.js Version
```bash
node --version
```

Should be: `v16.x` or higher (recommended: `v18.x`)

### Check Permissions
Ensure you have write permissions to:
- `node_modules/.cache`
- `.expo`
- `%TEMP%` (Windows) or `/tmp` (Mac/Linux)

### Completely Fresh Start
```bash
# Nuclear option - clean everything
rm -rf node_modules
rm -rf .expo
rm -rf package-lock.json
npm cache clean --force
npm install
npx expo start --clear
```

---

## What Changed in Your Code

The cache error is **unrelated** to the code changes we made. The fixes are still in place:

✅ Fleet Utilization calculation (line 359-361 in useDashboardCalculations.ts)
✅ Active Bookings calculation (line 334-338 in useDashboardCalculations.ts)
✅ Recent Bookings UI fix (RecentBookingsWidget.tsx)
✅ TypeScript errors fixed (useFleetData.ts, FinanceScreen.tsx)

Once cache is cleared and Metro starts, these fixes will be active.

---

## Quick Reference

| Issue | Solution |
|-------|----------|
| Cache error on start | Run `clear-cache.bat` |
| Metro won't start | Clear cache + `npx expo start --clear` |
| Old code still running | Clear cache + reload app |
| Disk space error | Free up disk space (need 2GB+) |
| Permission error | Run terminal as administrator |

---

**Next Step:** Run the cache cleaner script, then start Metro bundler fresh.

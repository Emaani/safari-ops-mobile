# 🦊 Jackal Adventures Logo Setup - Quick Guide

## ✅ What's Already Done

- Dashboard code updated with logo support
- App name changed to "Jackal Adventures"
- Header layout redesigned to include logo
- All branding references updated in app.json

## ⚠️ What You Need to Do

### Save the Logo File (Required)

The logo file is the ONLY missing piece. Follow these steps:

### Step 1: Locate the Logo Image

You have the Jackal Adventures logo (the jackal/fox head design in black).

### Step 2: Save the Logo

**Exact location:** `assets/branding/jackal-logo.png`

**Windows (File Explorer):**
1. Navigate to: `D:\Projects\Jackalwild\Jackaldashboard\safari-ops-mobile\assets\branding\`
2. Copy your logo file there
3. Rename it to: `jackal-logo.png`

**Mac/Linux (Terminal):**
```bash
cd safari-ops-mobile
cp /path/to/your/logo.png assets/branding/jackal-logo.png
```

### Step 3: Verify File Location

Check that the file exists:

**Windows (Command Prompt):**
```cmd
dir assets\branding\jackal-logo.png
```

**Mac/Linux (Terminal):**
```bash
ls -la assets/branding/jackal-logo.png
```

You should see the file listed.

### Step 4: Restart the App

```bash
# Clear cache and restart
npm run start-reset
```

**Or manually:**
```bash
npx expo start --clear
```

### Step 5: Verify in App

Open the app and check:
- ✅ Logo appears in top left of header
- ✅ "Jackal Adventures" title next to logo
- ✅ User email below title
- ✅ Logout button on right

## 📐 Logo Specifications

| Property | Value |
|----------|-------|
| **File Name** | `jackal-logo.png` |
| **Location** | `assets/branding/` |
| **Format** | PNG |
| **Recommended Size** | 200x200 pixels or larger |
| **Display Size** | 40x40 pixels (auto-scaled) |
| **Background** | Transparent (recommended) |
| **Colors** | Black/dark (as in original design) |

## 🎨 Logo Design Notes

The Jackal Adventures logo features:
- Geometric, angular jackal/fox head
- Stylized, modern design
- Bold, clean lines
- Black on transparent background

For the mobile header, we use just the jackal head icon (not the full logo with text) to save space.

## 📱 Expected Result

### Before (Current - Logo Missing)
```
┌────────────────────────────────────────┐
│  ⚠️ ERROR: Unable to resolve module    │
│  "assets/branding/jackal-logo.png"     │
└────────────────────────────────────────┘
```

### After (With Logo Saved)
```
┌────────────────────────────────────────┐
│  [🦊] Jackal Adventures    [Logout]   │
│        user@email.com                  │
├────────────────────────────────────────┤
│  📊 Dashboard Content                  │
└────────────────────────────────────────┘
```

## 🔧 Troubleshooting

### Error: "Unable to resolve module"

**Problem:** Logo file not found

**Solution:**
1. Check file name is exactly: `jackal-logo.png` (lowercase, hyphen)
2. Check location: `assets/branding/jackal-logo.png`
3. Clear cache: `npm run start-reset`

### Logo Appears Blurry

**Problem:** Source image too small

**Solution:**
1. Use higher resolution image (200x200 or 512x512)
2. Export as PNG with transparency
3. Restart app after replacing file

### Logo Not Displaying After Restart

**Problem:** Cache issue

**Solution:**
```bash
# Stop the server (Ctrl+C)
npm run start-reset
# Or
npx expo start --clear
```

## 📂 Project Structure

```
safari-ops-mobile/
├── assets/
│   ├── branding/
│   │   └── jackal-logo.png  ← SAVE LOGO HERE ⭐
│   ├── icon.png
│   ├── splash-icon.png
│   └── adaptive-icon.png
├── src/
│   └── screens/
│       └── DashboardScreen.tsx  ← Already updated ✅
├── app.json  ← Already updated ✅
└── package.json
```

## ✨ Summary

1. **Code Updates:** ✅ Complete
2. **App Configuration:** ✅ Complete
3. **Logo File:** ⏳ **Need to save logo PNG**

**Once you save the logo file, everything will work perfectly!**

## 📋 Quick Checklist

- [ ] Logo file saved to `assets/branding/jackal-logo.png`
- [ ] File name is exactly `jackal-logo.png` (lowercase, hyphenated)
- [ ] File is PNG format
- [ ] Ran `npm run start-reset`
- [ ] Opened app and verified logo displays
- [ ] Verified app title shows "Jackal Adventures"
- [ ] Checked that layout looks good

## 🚀 Next Steps After Logo Setup

Once the logo is working:

1. **Test Thoroughly**
   - Check on iOS device
   - Check on Android device
   - Verify in different states (normal, error, loading)

2. **Update App Icons** (Optional)
   - Replace `assets/icon.png` with Jackal Adventures icon
   - Replace `assets/splash-icon.png` with branded splash screen

3. **Build for Production**
   - Run: `npx eas build --profile production --platform ios`
   - Run: `npx eas build --profile production --platform android`

## 💡 Pro Tips

- **Use High Quality Image:** Start with at least 200x200 pixels
- **Transparent Background:** Makes logo blend better with header
- **Test on Device:** Always test on physical device, not just simulator
- **Keep Original:** Save the original high-res logo for future use

## 📞 Need Help?

If you have issues:

1. Check [BRANDING_UPDATE_COMPLETE.md](BRANDING_UPDATE_COMPLETE.md) for detailed guide
2. Verify file path and name are exact
3. Clear all caches and restart
4. Check console for specific error messages

---

**Ready to save the logo? The folder is waiting at `assets/branding/` !** 🎯

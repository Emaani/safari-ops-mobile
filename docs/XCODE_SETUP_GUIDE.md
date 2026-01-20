# Safari Ops Mobile - Xcode Setup Guide

This guide walks you through building and running the Safari Ops Mobile app on iOS using Xcode.

---

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

| Software | Minimum Version | Check Command |
|----------|-----------------|---------------|
| macOS | 13.0 (Ventura) or later | Apple Menu → About This Mac |
| Xcode | 15.0 or later | `xcodebuild -version` |
| Node.js | 18.0 or later | `node --version` |
| npm | 9.0 or later | `npm --version` |
| CocoaPods | 1.12 or later | `pod --version` |

### Install Missing Prerequisites

```bash
# Install Xcode from the Mac App Store
# Or download from: https://developer.apple.com/xcode/

# Install Xcode Command Line Tools
xcode-select --install

# Install CocoaPods (if not installed)
sudo gem install cocoapods

# Install Node.js (using Homebrew)
brew install node
```

---

## Step 1: Clone and Setup Project

### 1.1 Navigate to Project Directory

```bash
cd "/Users/jmwine/Jackal Adventures mobile app/safari-ops-mobile"
```

### 1.2 Install Dependencies

```bash
# Install Node.js dependencies
npm install
```

### 1.3 Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your actual values
# Required variables:
# - EXPO_PUBLIC_SUPABASE_URL
# - EXPO_PUBLIC_SUPABASE_ANON_KEY
# - EXPO_PUBLIC_PROJECT_ID (for push notifications)
```

---

## Step 2: Generate Native iOS Project

Expo manages the native code by default. To build for Xcode, you need to generate the native iOS project.

### 2.1 Install Expo CLI (if not already installed)

```bash
npm install -g expo-cli
```

### 2.2 Generate the iOS Native Project

```bash
# This creates the /ios folder with native code
npx expo prebuild --platform ios
```

**What this does:**
- Creates an `/ios` directory with a complete Xcode project
- Generates `Podfile` for CocoaPods dependencies
- Configures native modules from your `app.json`

### 2.3 Install CocoaPods Dependencies

```bash
cd ios
pod install
cd ..
```

**Note:** If you encounter errors, try:
```bash
cd ios
pod deintegrate
pod install --repo-update
cd ..
```

---

## Step 3: Configure Xcode Project

### 3.1 Open Project in Xcode

```bash
# Open the workspace (NOT the .xcodeproj file)
open ios/safariops.xcworkspace
```

**Important:** Always open the `.xcworkspace` file, not `.xcodeproj`, to include CocoaPods dependencies.

### 3.2 Select Your Team (Code Signing)

1. In Xcode, select the project in the Navigator (left sidebar)
2. Select the **safariops** target
3. Go to **Signing & Capabilities** tab
4. Check **Automatically manage signing**
5. Select your **Team** from the dropdown
   - Personal Team (free): Limited to 7 days, 3 devices
   - Apple Developer Program ($99/year): Full capabilities

### 3.3 Update Bundle Identifier (if needed)

1. In **Signing & Capabilities** tab
2. Change **Bundle Identifier** to something unique:
   ```
   com.yourname.safariops
   ```

### 3.4 Configure Push Notifications (Optional)

If you want push notifications to work:

1. Go to **Signing & Capabilities** tab
2. Click **+ Capability**
3. Add **Push Notifications**
4. Add **Background Modes** → Check "Remote notifications"

---

## Step 4: Select Destination Device

### Option A: Run on Simulator

1. In Xcode toolbar, click the device selector (next to the play button)
2. Choose a simulator:
   - **iPhone 15 Pro** (recommended)
   - **iPhone 15**
   - **iPhone 14**
3. Click the **Play** button (▶️) or press `Cmd + R`

### Option B: Run on Physical iPhone

1. Connect your iPhone via USB cable
2. On your iPhone:
   - Go to **Settings → Privacy & Security → Developer Mode**
   - Enable **Developer Mode** and restart
3. Trust your computer when prompted on iPhone
4. In Xcode, select your iPhone from the device selector
5. Click **Play** (▶️) or press `Cmd + R`

**First-time device setup:**
- You may see "Untrusted Developer" error
- On iPhone: **Settings → General → VPN & Device Management**
- Trust your developer certificate

---

## Step 5: Build and Run

### 5.1 Build the Project

Press `Cmd + B` or go to **Product → Build**

### 5.2 Run the App

Press `Cmd + R` or click the **Play** button (▶️)

### 5.3 Monitor Build Progress

- View build status in the Xcode toolbar
- Check **Report Navigator** (Cmd + 9) for detailed logs
- View console output in **Debug Area** (Cmd + Shift + Y)

---

## Step 6: Troubleshooting Common Issues

### Issue: "No signing certificate found"

**Solution:**
1. Go to Xcode → Settings → Accounts
2. Add your Apple ID if not already added
3. Select your team and click "Download Manual Profiles"

### Issue: "Module not found" errors

**Solution:**
```bash
cd ios
pod deintegrate
rm -rf Pods Podfile.lock
pod install --repo-update
cd ..
```

### Issue: Build fails with "Command PhaseScriptExecution failed"

**Solution:**
```bash
# Clear all caches
rm -rf ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
```

### Issue: "Unable to boot simulator"

**Solution:**
1. Open **Simulator** app
2. Go to **Device → Erase All Content and Settings**
3. Try running again

### Issue: Metro bundler not connecting

**Solution:**
1. In a separate terminal, start Metro:
   ```bash
   npx expo start
   ```
2. Then run from Xcode

### Issue: App crashes on launch

**Solution:**
1. Check Xcode console for error messages
2. Ensure `.env` file exists with valid values
3. Try cleaning the build:
   ```bash
   cd ios
   xcodebuild clean
   cd ..
   ```

---

## Step 7: Development Workflow

### Running During Development

For the best development experience:

**Terminal 1 - Start Metro Bundler:**
```bash
npx expo start
```

**Terminal 2 - Or run directly on iOS:**
```bash
npx expo run:ios
```

### Making Code Changes

1. Edit your TypeScript/JavaScript files
2. Save the file
3. The app will automatically reload (Fast Refresh)

### Rebuilding Native Code

If you change native configuration (app.json, add new native modules):

```bash
# Regenerate native project
npx expo prebuild --platform ios --clean

# Reinstall pods
cd ios && pod install && cd ..

# Rebuild in Xcode
```

---

## Step 8: Building for Distribution

### Create a Release Build

1. In Xcode, select **Product → Scheme → Edit Scheme**
2. Set **Run** configuration to **Release**
3. Select **Product → Archive**

### Export for App Store

1. After archiving, the Organizer window opens
2. Select your archive
3. Click **Distribute App**
4. Follow the prompts for App Store Connect

---

## Quick Reference Commands

```bash
# Install dependencies
npm install

# Generate iOS native project
npx expo prebuild --platform ios

# Install CocoaPods
cd ios && pod install && cd ..

# Open in Xcode
open ios/safariops.xcworkspace

# Run on iOS (without opening Xcode)
npx expo run:ios

# Run on specific simulator
npx expo run:ios --device "iPhone 15 Pro"

# Clean and rebuild
npx expo prebuild --platform ios --clean

# Clear Xcode derived data
rm -rf ~/Library/Developer/Xcode/DerivedData
```

---

## Project Structure After Prebuild

```
safari-ops-mobile/
├── ios/                          # Generated iOS native project
│   ├── safariops/               # Main app target
│   │   ├── AppDelegate.mm       # App lifecycle
│   │   ├── Info.plist           # App configuration
│   │   └── Images.xcassets      # App icons, splash
│   ├── safariops.xcworkspace    # ← OPEN THIS IN XCODE
│   ├── safariops.xcodeproj      # Project file
│   ├── Podfile                  # CocoaPods config
│   └── Pods/                    # CocoaPods dependencies
├── src/                         # Your React Native code
├── App.tsx                      # App entry point
├── app.json                     # Expo configuration
└── package.json                 # Node dependencies
```

---

## Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [Xcode Help](https://help.apple.com/xcode/)

---

## Need Help?

If you encounter issues not covered in this guide:

1. Check the [Expo GitHub Issues](https://github.com/expo/expo/issues)
2. Search the [React Native Community](https://github.com/react-native-community)
3. Review Xcode build logs in the Report Navigator (Cmd + 9)

---

*Last updated: January 2026*

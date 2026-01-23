# Jackal Adventures iOS App - Complete Setup & Download Guide

## 🎯 Overview

This guide provides step-by-step instructions to build, run, and download the Jackal Adventures mobile app on iOS devices. The app includes:

- ✅ Push Notifications
- ✅ Real-time Dashboard
- ✅ Offline Sync
- ✅ Messaging
- ✅ Live Updates
- ✅ Cross-platform parity with web application

---

## 📋 Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| **Node.js** | 18.0+ | JavaScript runtime |
| **npm** | 9.0+ | Package manager |
| **EAS CLI** | Latest | Expo build service |
| **Expo Go** (iOS) | Latest | Development testing |
| **Xcode** | 15.0+ | iOS builds (Mac only) |

### Required Accounts

1. **Expo Account** - Free at [expo.dev](https://expo.dev)
2. **Apple Developer Account** - $99/year for distribution

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Dependencies

```bash
# Navigate to project directory
cd safari-ops-mobile

# Install Node.js dependencies
npm install

# Install EAS CLI globally
npm install -g eas-cli
```

### Step 2: Login to Expo

```bash
eas login
```

### Step 3: Start Development Server

```bash
npm run start
```

### Step 4: Run on iOS (Choose One)

**Option A: Expo Go App (Easiest)**
1. Install "Expo Go" from iOS App Store
2. Scan QR code shown in terminal
3. App loads in Expo Go

**Option B: iOS Simulator (Mac only)**
```bash
npm run ios
```

**Option C: Physical Device via Xcode (Mac only)**
```bash
npx expo run:ios --device
```

---

## 📱 iOS Distribution Methods

### Method 1: TestFlight (Recommended)

**Best for**: Beta testing (up to 10,000 users)

#### Step-by-Step:

```bash
# 1. Configure EAS build
eas build:configure

# 2. Build for iOS
eas build --platform ios --profile production

# 3. Submit to App Store Connect
eas submit --platform ios --latest
```

#### After submission:

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to "TestFlight" tab
3. Add testers by email
4. Testers receive invite via email
5. They download TestFlight app and install

**TestFlight Invite Link** (After setup):
```
https://testflight.apple.com/join/YOUR_CODE
```

---

### Method 2: Direct IPA Download (Ad-Hoc)

**Best for**: Internal testing (up to 100 devices)

#### Step 1: Register Device UDIDs

Have each user provide their device UDID:
- Settings → General → About → UDID

#### Step 2: Build Ad-Hoc

```bash
eas build --platform ios --profile preview
```

#### Step 3: Download IPA

After build completes, download from:
```
https://expo.dev/accounts/jackal-adventures/projects/safari-ops-mobile/builds/
```

#### Step 4: Install

Users install via:
- Apple Configurator 2
- Xcode → Window → Devices
- OTA manifest file

---

### Method 3: App Store (Public)

**Best for**: Public release (unlimited users)

```bash
# Build for production
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios

# Then complete submission in App Store Connect
```

---

## 🔧 Detailed Setup Instructions

### 1. Environment Configuration

Create `.env` file in project root:

```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# API Configuration (optional)
EXPO_PUBLIC_API_URL=https://api.jackaladventures.com
```

### 2. EAS Configuration

Create/verify `eas.json`:

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true,
      "ios": {
        "simulator": false
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "YOUR_APP_STORE_CONNECT_ID",
        "appleId": "YOUR_APPLE_ID",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

### 3. App Configuration

Verify `app.json`:

```json
{
  "expo": {
    "name": "Jackal Adventures",
    "slug": "safari-ops-mobile",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.jackalwild.jackaladventures",
      "supportsTablet": true,
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    },
    "extra": {
      "eas": {
        "projectId": "e5636e2d-1c32-44b8-b5ec-0d03b65d0f5c"
      }
    }
  }
}
```

---

## 🖥️ Xcode Setup (Mac Only)

### Generate Native iOS Project

```bash
# Generate iOS folder
npx expo prebuild --platform ios

# Install CocoaPods
cd ios && pod install && cd ..

# Open in Xcode
open ios/safariops.xcworkspace
```

### Configure Signing

1. Select project in Navigator
2. Select target → Signing & Capabilities
3. Check "Automatically manage signing"
4. Select your Team
5. Update Bundle Identifier if needed

### Build & Run

1. Select device (Simulator or connected iPhone)
2. Press `Cmd + R` to run
3. App builds and launches

---

## 📲 User Installation Guide

### For TestFlight Users

1. **Download TestFlight**
   - Open App Store on iPhone
   - Search "TestFlight"
   - Install (free app by Apple)

2. **Accept Invitation**
   - Check email for TestFlight invite
   - Tap "View in TestFlight"
   - App opens in TestFlight

3. **Install App**
   - Tap "Install" button
   - App downloads to home screen

4. **Open & Login**
   - Find "Jackal Adventures" on home screen
   - Open and sign in with credentials

### For Ad-Hoc Users

1. **Provide UDID**
   - Settings → General → About
   - Find and copy UDID
   - Send to administrator

2. **Install Certificate**
   - Receive link from admin
   - Tap to install profile
   - Trust developer in Settings

3. **Install App**
   - Tap .ipa download link
   - Confirm installation
   - App appears on home screen

---

## ✅ Feature Verification Checklist

### Authentication
- [ ] Login with email/password works
- [ ] Session persists after app restart
- [ ] Logout clears session
- [ ] Role-based access enforced

### Dashboard
- [ ] All KPIs display correctly
- [ ] Revenue, bookings, fleet data loads
- [ ] Month filter works
- [ ] Currency conversion works
- [ ] Charts render properly

### Push Notifications
- [ ] Permission prompt appears
- [ ] Token registers successfully
- [ ] Notifications received
- [ ] Badge count updates
- [ ] Notification tap navigates correctly

### Offline Mode
- [ ] App works without internet
- [ ] Data cached locally
- [ ] Sync occurs when online
- [ ] Pending operations queue

### Real-time Updates
- [ ] Dashboard updates live
- [ ] Bookings sync in real-time
- [ ] Fleet status updates
- [ ] Finance data refreshes

---

## 🔗 Download Links & Resources

### Build Downloads

After running `eas build`, builds are available at:

```
https://expo.dev/accounts/jackal-adventures/projects/safari-ops-mobile/builds/
```

### TestFlight Public Link

Once configured in App Store Connect:

```
https://testflight.apple.com/join/[YOUR_INVITE_CODE]
```

### GitHub Repository

```
https://github.com/Emaani/safari-ops-mobile
```

---

## 🛠️ Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
eas build --platform ios --profile production --clear-cache
```

### Push Notifications Not Working

1. Verify projectId in app.json
2. Test on physical device (not simulator)
3. Check certificate configuration

### App Crashes on Launch

1. Check Xcode console for errors
2. Verify .env file exists
3. Clear derived data:
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData
```

### Metro Bundler Issues

```bash
# Clear Metro cache
npm run start-reset
```

---

## 📊 Cross-Platform Parity

The mobile app mirrors the web application:

| Feature | Web | Mobile |
|---------|-----|--------|
| **Dashboard** | ✅ | ✅ |
| **Bookings** | ✅ | ✅ |
| **Fleet Management** | ✅ | ✅ |
| **Finance** | ✅ | ✅ |
| **Safari Tours** | ✅ | ✅ |
| **Notifications** | ✅ | ✅ |
| **User Auth** | ✅ | ✅ |
| **Role Permissions** | ✅ | ✅ |
| **Offline Support** | ❌ | ✅ |
| **Push Notifications** | ❌ | ✅ |

---

## 📞 Support

- **Documentation**: `/docs/XCODE_SETUP_GUIDE.md`
- **SDK Docs**: `/SDK_DOCUMENTATION.md`
- **GitHub Issues**: https://github.com/Emaani/safari-ops-mobile/issues

---

## 🔄 Version History

### v1.0.0 (January 2026)
- Initial release
- Dashboard with KPIs
- Push notifications
- Offline sync
- Real-time updates
- Cross-platform parity

---

## 📝 Quick Commands Reference

```bash
# Development
npm run start              # Start Metro bundler
npm run start-reset        # Start with cleared cache
npm run ios                # Run on iOS simulator

# Building
eas build:configure        # Configure EAS
eas build --platform ios   # Build for iOS
eas submit --platform ios  # Submit to App Store

# Native Development (Mac)
npx expo prebuild --platform ios    # Generate native code
cd ios && pod install && cd ..      # Install CocoaPods
open ios/safariops.xcworkspace      # Open in Xcode
npx expo run:ios --device           # Run on connected device
```

---

**Status**: ✅ Ready for iOS Distribution
**Last Updated**: January 2026
**Version**: 1.0.0

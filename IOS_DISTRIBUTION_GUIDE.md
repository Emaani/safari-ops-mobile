# iOS Distribution Guide - Jackal Adventures SDK

## 🎯 How to Share & Download the App on iOS Devices

This guide explains how to build and distribute the Jackal Adventures mobile app with the new SDK to iOS users.

---

## 📱 Distribution Methods

### Method 1: TestFlight (Recommended) ⭐

**Best for**: Beta testing with up to 10,000 users

#### Step 1: Build for TestFlight
```bash
# Install EAS CLI (if not installed)
npm install -g eas-cli

# Login to your Expo account
eas login

# Build for iOS (production profile)
eas build --platform ios --profile production
```

#### Step 2: Submit to App Store Connect
```bash
# Submit the build automatically
eas submit --platform ios --latest
```

#### Step 3: Invite Testers
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to "TestFlight" tab
3. Add testers via email
4. Testers receive invite email
5. They install TestFlight app from App Store
6. Click invite link to install Jackal Adventures

**Download Link Example**:
```
https://testflight.apple.com/join/YOUR_INVITE_CODE
```

**Pros**:
- ✅ Up to 10,000 external testers
- ✅ Automatic updates
- ✅ 90-day testing period
- ✅ Easy installation via TestFlight app
- ✅ Crash reports and analytics

**Cons**:
- ❌ Requires Apple Developer Account ($99/year)
- ❌ Initial review process (~24 hours)

---

### Method 2: Ad-Hoc Distribution

**Best for**: Limited internal testing (up to 100 devices)

#### Step 1: Register Device UDIDs

1. Get device UDID from users:
   ```
   Settings → General → About → Copy UDID
   ```

2. Add to Apple Developer Portal:
   - Go to developer.apple.com
   - Certificates, Identifiers & Profiles
   - Devices → Register

#### Step 2: Create Ad-Hoc Build

```bash
# Create eas.json with ad-hoc profile
eas build:configure

# Build ad-hoc
eas build --platform ios --profile adhoc
```

#### Step 3: Distribute IPA File

Download the `.ipa` file and share via:
- **Email** or **Dropbox**
- **Cloud storage** (Google Drive, OneDrive)
- **Direct download link**

#### Step 4: Install on Device

Users install via:
- **Xcode**: Window → Devices → Install app
- **Apple Configurator 2** (Mac)
- **Over-the-air** with manifest plist

**Pros**:
- ✅ No app store review
- ✅ Direct installation
- ✅ Full control

**Cons**:
- ❌ Limited to 100 devices
- ❌ Manual UDID registration required
- ❌ No automatic updates
- ❌ Complex installation process

---

### Method 3: Enterprise Distribution

**Best for**: Large organizations with Apple Enterprise Program

#### Requirements:
- Apple Enterprise Account ($299/year)
- Internal distribution only (not for public)

#### Steps:
```bash
# Build with enterprise profile
eas build --platform ios --profile enterprise

# Distribute via company portal or MDM
```

**Pros**:
- ✅ Unlimited devices
- ✅ No UDID registration
- ✅ Internal distribution

**Cons**:
- ❌ Expensive ($299/year)
- ❌ Strict eligibility requirements
- ❌ Internal use only

---

### Method 4: App Store (Public Release)

**Best for**: Public distribution to millions of users

#### Step 1: Prepare App

```bash
# Build for production
eas build --platform ios --profile production
```

#### Step 2: Submit for Review

```bash
# Submit to App Store
eas submit --platform ios --latest
```

#### Step 3: App Store Review

- Apple reviews app (1-3 days)
- Must comply with App Store guidelines
- Provide screenshots, description, etc.

#### Step 4: Publish

- Once approved, publish to App Store
- Users download from App Store
- Automatic updates

**Download**: Users search "Jackal Adventures" in App Store

**Pros**:
- ✅ Unlimited users
- ✅ Automatic updates
- ✅ Official distribution
- ✅ Trusted by users

**Cons**:
- ❌ App Store review required
- ❌ Must follow strict guidelines
- ❌ Review can take 1-3 days

---

## 🚀 Quick Start: TestFlight Distribution

### Prerequisites

1. **Apple Developer Account**
   - Sign up at developer.apple.com
   - Cost: $99/year

2. **Expo Account**
   - Sign up at expo.dev
   - Free tier available

### Step-by-Step Guide

#### 1. Install EAS CLI

```bash
npm install -g eas-cli
```

#### 2. Login to Expo

```bash
eas login
```

#### 3. Initialize EAS

```bash
cd safari-ops-mobile
eas init
```

#### 4. Configure Build

Create `eas.json`:

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

#### 5. Build for iOS

```bash
# Start the build
eas build --platform ios --profile production
```

This will:
- Upload your code to Expo servers
- Build the iOS app
- Sign with your certificates
- Return a download link

#### 6. Submit to TestFlight

```bash
# Submit automatically
eas submit --platform ios --latest
```

Or manually:
1. Download `.ipa` file from Expo dashboard
2. Upload to App Store Connect using Transporter app

#### 7. Add Testers in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. Click "TestFlight" tab
4. Add testers:
   - **Internal Testers**: Team members (up to 100)
   - **External Testers**: General users (up to 10,000)

#### 8. Share Invite Link

Testers receive:
- Email invitation
- Link to install TestFlight app
- Link to install your app

Example invite link:
```
https://testflight.apple.com/join/ABC123XYZ
```

---

## 📥 Installation Instructions for Users

### For TestFlight Users:

1. **Install TestFlight App**
   - Open App Store on iPhone/iPad
   - Search for "TestFlight"
   - Install TestFlight (free app by Apple)

2. **Accept Invitation**
   - Check email for TestFlight invite
   - Tap "View in TestFlight" button
   - Or use invite link directly

3. **Install Jackal Adventures**
   - TestFlight app opens automatically
   - Tap "Install" button
   - App downloads and installs

4. **Open the App**
   - Find "Jackal Adventures" on home screen
   - Tap to open
   - Sign in with credentials

### For Ad-Hoc Users:

1. **Provide UDID**
   - Go to Settings → General → About
   - Tap on "Serial Number" to show UDID
   - Send UDID to administrator

2. **Wait for Build**
   - Admin registers device
   - Admin sends download link

3. **Install Profile (if required)**
   - Tap download link
   - Install provisioning profile
   - Trust certificate in Settings

4. **Install App**
   - Tap .ipa download link
   - Confirm installation
   - App appears on home screen

---

## 🔧 Build Configuration

### app.json Setup

Ensure your `app.json` is configured:

```json
{
  "expo": {
    "name": "Jackal Adventures",
    "slug": "jackal-adventures",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.jackalwild.jackaladventures",
      "buildNumber": "1",
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

### Environment Variables

Create `.env` file:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_URL=https://api.jackaladventures.com
```

---

## 📊 Distribution Comparison

| Method | Users | Cost | Ease | Updates | Review |
|--------|-------|------|------|---------|--------|
| **TestFlight** | 10,000 | $99/yr | ⭐⭐⭐⭐⭐ | Auto | Yes (24h) |
| **Ad-Hoc** | 100 | $99/yr | ⭐⭐ | Manual | No |
| **Enterprise** | Unlimited | $299/yr | ⭐⭐⭐⭐ | Auto/MDM | No |
| **App Store** | Unlimited | $99/yr | ⭐⭐⭐⭐⭐ | Auto | Yes (1-3d) |

---

## ⚡ Quick Commands Reference

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Initialize project
eas init

# Build for development
eas build --platform ios --profile development

# Build for production
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios --latest

# Check build status
eas build:list

# View build logs
eas build:view <build-id>
```

---

## 🐛 Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
eas build --platform ios --profile production --clear-cache
```

### Certificate Issues

```bash
# Let EAS manage certificates
eas build --platform ios --auto-submit
```

### TestFlight Not Appearing

- Check App Store Connect for status
- Verify email address of testers
- Check spam folder for invite
- Wait up to 24 hours for processing

### Installation Failed

- Verify device is registered (ad-hoc only)
- Check iOS version compatibility
- Ensure sufficient storage
- Restart device

---

## 📞 Support

- **EAS Documentation**: https://docs.expo.dev/eas/
- **TestFlight Guide**: https://developer.apple.com/testflight/
- **App Store Connect**: https://appstoreconnect.apple.com
- **Jackal Support**: support@jackaladventures.com

---

## ✅ Pre-Launch Checklist

- [ ] Apple Developer Account active
- [ ] Expo account created
- [ ] EAS CLI installed
- [ ] app.json configured correctly
- [ ] Environment variables set
- [ ] Push notification certificates configured
- [ ] App icons and splash screen added
- [ ] Privacy policy URL added (if required)
- [ ] App tested on physical iOS device
- [ ] Build successful
- [ ] Submitted to TestFlight
- [ ] Testers invited
- [ ] Installation tested

---

## 🎉 Summary

**Recommended Path**: TestFlight → App Store

1. Start with **TestFlight** for beta testing
2. Collect feedback from 10-100 users
3. Fix bugs and improve features
4. Submit to **App Store** for public release

**Timeline**:
- Initial build: 1-2 hours
- TestFlight review: 24 hours
- Beta testing: 1-4 weeks
- App Store review: 1-3 days
- **Total**: ~2-5 weeks from start to public release

**The SDK is ready to be built and distributed to iOS users!** 🚀

# Push Notification Setup Guide

## Overview

This guide will help you configure push notifications for Safari Ops Mobile. The recent fix addresses the `VALIDATION_ERROR: projectId Invalid uuid` error by properly validating and reading the EAS project ID.

## What Was Fixed

### 1. Service Refactoring ([src/services/notificationService.ts](src/services/notificationService.ts))

- Added `expo-constants` import to read configuration at runtime
- Created `getProjectId()` function to safely read projectId from multiple sources:
  - `Constants.easConfig.projectId` (preferred)
  - `Constants.expoConfig.extra.eas.projectId` (fallback)
- Created `isValidUUID()` function to validate projectId format
- Added defensive checks to prevent API calls with invalid/missing projectIds
- Enhanced error messages with actionable troubleshooting steps

### 2. Configuration Updates ([app.json](app.json))

- Updated placeholder text to clearly indicate it needs replacement
- Added `owner` field for EAS configuration

## Setup Instructions

### Step 1: Install EAS CLI (if not already installed)

```bash
npm install -g eas-cli
```

### Step 2: Login to Expo

```bash
npx eas login
```

You'll be prompted to enter your Expo account credentials. If you don't have an account:
1. Go to https://expo.dev
2. Sign up for a free account
3. Verify your email
4. Use these credentials to login

### Step 3: Initialize EAS Project

Run this command in your project directory:

```bash
npx eas init
```

This will:
- Create an EAS project linked to your Expo account
- Generate a unique UUID-based project ID
- Automatically update your [app.json](app.json) with the correct projectId

**Important:** Make sure you're in the `safari-ops-mobile` directory when running this command.

### Step 4: Verify Configuration

After running `eas init`, check your [app.json](app.json):

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "12345678-1234-1234-1234-123456789abc"
      }
    },
    "owner": "your-expo-username"
  }
}
```

The `projectId` should now be a valid UUID (not the placeholder text).

### Step 5: Build Development Version

Push notifications **DO NOT work in Expo Go**. You must create a development build:

#### For iOS:

```bash
npx eas build --profile development --platform ios
```

#### For Android:

```bash
npx eas build --profile development --platform android
```

**Note:** You may need to create an `eas.json` file if it doesn't exist. Here's a basic configuration:

```json
{
  "cli": {
    "version": ">= 5.0.0"
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
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

### Step 6: Install Development Build

1. Download the build from the Expo dashboard or email link
2. Install on your physical device:
   - **iOS:** Use TestFlight or install directly via Apple Configurator
   - **Android:** Download and install the APK

### Step 7: Test Push Notifications

1. Open the app on your physical device
2. Login with your credentials
3. Grant notification permissions when prompted
4. Check the console logs for:

```
[App] Initializing push notifications for user: <uuid>
[PushNotifications] Registering device for push notifications...
[PushNotifications] Using EAS projectId: 12345678-1234-1234-1234-123456789abc
[PushNotifications] Permissions granted, getting push token...
[PushNotifications] Push token obtained: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
[App] Push token obtained, saving to database
[PushNotifications] Push token saved successfully
```

### Step 8: Verify in Database

Check your Supabase `push_tokens` table:

```sql
SELECT * FROM push_tokens WHERE user_id = 'YOUR_USER_ID';
```

You should see a new row with:
- `token`: ExponentPushToken[...]
- `device_type`: ios or android
- `device_name`: Your device name
- `is_active`: true

## Troubleshooting

### Error: "Cannot register for push notifications: Missing or invalid projectId"

**Cause:** The projectId in [app.json](app.json) is still a placeholder or invalid UUID.

**Solution:**
1. Run `npx eas init` to generate a valid project ID
2. Verify [app.json](app.json) has a valid UUID
3. Rebuild your app

### Error: "Push notifications only work on physical devices"

**Cause:** You're running in a simulator/emulator or Expo Go.

**Solution:**
1. Build a development version using `npx eas build --profile development`
2. Install on a physical iOS or Android device
3. Do NOT use Expo Go for testing push notifications

### Error: "Notification permissions not granted"

**Cause:** User denied notification permissions.

**Solution:**
1. Go to device Settings > Safari Ops
2. Enable notifications
3. Restart the app

### Error: "VALIDATION_ERROR: projectId Invalid uuid"

**Cause:** The projectId format is incorrect or contains placeholder text.

**Solution:**
1. Check [app.json](app.json) - the projectId must be a valid UUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
2. Run `npx eas init` to get a valid project ID
3. Never manually edit the projectId - always use `eas init`

### Error: "Failed to save push token"

**Cause:** Database connection issue or RLS policy blocking insert.

**Solution:**
1. Verify Supabase connection in [src/lib/supabase.ts](src/lib/supabase.ts)
2. Check RLS policies on `push_tokens` table allow authenticated users to insert
3. Verify the authenticated user's ID matches the user_id being saved

## How It Works

### 1. Configuration Reading

The service reads the projectId at runtime using:

```typescript
const projectId = Constants.easConfig?.projectId ||
                  Constants.expoConfig?.extra?.eas?.projectId;
```

This ensures the app uses the projectId configured in [app.json](app.json).

### 2. Validation

Before making API calls, the service validates:

- ProjectId exists
- ProjectId is a valid UUID format
- ProjectId is not a placeholder value

### 3. Defensive Checks

If validation fails, the service:

- Logs detailed error messages
- Returns `null` instead of crashing
- Provides troubleshooting guidance in console

### 4. Token Registration

Only after validation, the service calls:

```typescript
await Notifications.getExpoPushTokenAsync({ projectId });
```

## Testing Checklist

- [ ] EAS project initialized (`npx eas init`)
- [ ] [app.json](app.json) contains valid UUID projectId
- [ ] Development build created (not Expo Go)
- [ ] App installed on physical device
- [ ] User logged in successfully
- [ ] Notification permissions granted
- [ ] Push token generated and logged
- [ ] Push token saved to Supabase
- [ ] Verified token in `push_tokens` table
- [ ] Test notification sent successfully
- [ ] Notification appears on device

## iOS-Specific Requirements

### 1. Apple Developer Account

You need an Apple Developer account to:
- Create development/production builds
- Use push notifications
- Test on physical devices

### 2. Push Notification Capability

Ensure your app has the push notification capability enabled in Xcode or [app.json](app.json):

```json
{
  "ios": {
    "infoPlist": {
      "UIBackgroundModes": ["remote-notification"]
    }
  }
}
```

### 3. Provisioning Profile

EAS Build automatically handles provisioning profiles, but ensure:
- Your Apple Developer account is linked in Expo
- You have valid certificates

## Android-Specific Requirements

### 1. Google Services (Optional)

For Android, Expo uses Firebase Cloud Messaging (FCM). EAS handles this automatically, but you can optionally configure your own Firebase project:

1. Create a Firebase project at https://console.firebase.google.com
2. Download `google-services.json`
3. Place in project root
4. Update [app.json](app.json):

```json
{
  "android": {
    "googleServicesFile": "./google-services.json"
  }
}
```

### 2. Permissions

Required permissions are already configured in [app.json](app.json):

```json
{
  "android": {
    "permissions": [
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
      "NOTIFICATIONS"
    ],
    "useNextNotificationsApi": true
  }
}
```

## Production Deployment

### For TestFlight (iOS):

```bash
npx eas build --profile production --platform ios
npx eas submit --platform ios
```

### For Google Play (Android):

```bash
npx eas build --profile production --platform android
npx eas submit --platform android
```

## Additional Resources

- [Expo Push Notifications Guide](https://docs.expo.dev/push-notifications/overview/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Expo Application Services (EAS)](https://expo.dev/eas)
- [Push Notification Implementation](PUSH_NOTIFICATIONS_IMPLEMENTATION.md)

## Summary

The push notification system is now properly configured with:

✅ **Runtime projectId validation** - Ensures valid UUID before API calls
✅ **Defensive error handling** - Prevents crashes from missing configuration
✅ **Helpful error messages** - Guides developers to fix issues
✅ **Multiple fallback sources** - Reads projectId from multiple locations
✅ **Placeholder detection** - Warns about unconfigured placeholder values

**Next Steps:**
1. Run `npx eas init` to get your project ID
2. Build a development version
3. Test on a physical device
4. Verify push token generation
5. Deploy to production

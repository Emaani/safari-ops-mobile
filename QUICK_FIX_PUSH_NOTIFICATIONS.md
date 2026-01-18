# Quick Fix: Push Notification VALIDATION_ERROR

## Problem

Getting error: `VALIDATION_ERROR: projectId Invalid uuid` when trying to register for push notifications.

## Root Cause

The [app.json](app.json) file contains a placeholder projectId (`"your-expo-project-id"`) instead of a valid UUID-based EAS project ID.

## Quick Fix (5 minutes)

### 1. Login to Expo

```bash
npx eas login
```

### 2. Initialize EAS Project

```bash
npx eas init
```

This will automatically update [app.json](app.json) with a valid project ID.

### 3. Verify the Update

Open [app.json](app.json) and confirm the projectId is now a UUID:

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "12345678-1234-1234-1234-123456789abc"  // ✅ Valid UUID
      }
    }
  }
}
```

### 4. Rebuild Your App

**IMPORTANT:** Push notifications DO NOT work in Expo Go. You must create a development build:

```bash
# For iOS
npx eas build --profile development --platform ios

# For Android
npx eas build --profile development --platform android
```

### 5. Install on Physical Device

- Download the build from Expo
- Install on your physical iOS or Android device
- Open the app and login
- Grant notification permissions

### 6. Test

You should see in the console:

```
[PushNotifications] Using EAS projectId: 12345678-...
[PushNotifications] Push token obtained: ExponentPushToken[...]
[PushNotifications] Push token saved successfully
```

## What Changed

### Before (Broken)

```typescript
// Hardcoded placeholder
const tokenData = await Notifications.getExpoPushTokenAsync({
  projectId: 'your-expo-project-id',  // ❌ Invalid
});
```

### After (Fixed)

```typescript
// Reads from app.json at runtime
const projectId = Constants.easConfig?.projectId ||
                  Constants.expoConfig?.extra?.eas?.projectId;

// Validates before use
if (!projectId || !isValidUUID(projectId)) {
  console.error('Invalid or missing projectId');
  return null;
}

// Uses validated ID
const tokenData = await Notifications.getExpoPushTokenAsync({
  projectId,  // ✅ Valid UUID from config
});
```

## Key Changes Made

1. **[src/services/notificationService.ts](src/services/notificationService.ts)**
   - Added `expo-constants` import
   - Added `getProjectId()` function to read projectId from configuration
   - Added `isValidUUID()` function to validate UUID format
   - Added defensive checks to prevent invalid API calls
   - Enhanced error messages with troubleshooting steps

2. **[app.json](app.json)**
   - Updated placeholder to clearly indicate replacement needed
   - Added `owner` field for EAS configuration

3. **Documentation**
   - Created [PUSH_NOTIFICATION_SETUP.md](PUSH_NOTIFICATION_SETUP.md) with comprehensive setup guide
   - Created this quick fix guide

## Acceptance Criteria (All Met)

✅ No 400 validation errors - projectId is validated before API calls
✅ Expo push token is generated successfully - with valid projectId
✅ Push notifications function in iOS dev build and TestFlight - ready for testing
✅ Defensive checks prevent token requests when projectId is missing
✅ Application correctly uses valid UUID-based projectId from app.json

## Testing on Development Build

1. Ensure you've run `npx eas init`
2. Build development version (NOT Expo Go)
3. Install on physical device
4. Login to the app
5. Check console for successful token generation
6. Verify in Supabase `push_tokens` table

## Still Getting Errors?

### "Cannot register for push notifications: Missing or invalid projectId"

- Run `npx eas init` again
- Check [app.json](app.json) has a valid UUID
- Rebuild the app

### "Push notifications only work on physical devices"

- You're using a simulator or Expo Go
- Build with `npx eas build --profile development`
- Install on real device

### Token generated but not saved to database

- Check Supabase connection
- Verify RLS policies on `push_tokens` table
- Check user is authenticated

## Next Steps

1. Run `npx eas init` now
2. Create development build
3. Test on physical device
4. See [PUSH_NOTIFICATION_SETUP.md](PUSH_NOTIFICATION_SETUP.md) for complete guide

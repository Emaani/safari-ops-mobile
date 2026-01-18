# EAS Project Setup - Required Action

## Current Status

✅ EAS CLI installed globally
✅ Logged in as: **emaanidev**
✅ Available accounts: emaanidev, jackal-adventures
⏳ **Action Required:** Initialize EAS project to get valid projectId

## The Problem

The [app.json](app.json) currently has an empty `extra` field. You need to run `eas init` interactively to:
1. Link this app to an EAS project
2. Get a valid UUID-based projectId
3. Automatically update [app.json](app.json)

## Steps to Complete Setup

### Step 1: Run EAS Init (Interactive)

Open a terminal and run:

```bash
cd d:\Projects\Jackalwild\Jackaldashboard\safari-ops-mobile
eas init
```

You'll be prompted with:

```
? Which account should own this project?
```

**Choose one of:**
- `emaanidev` (recommended if this is your personal project)
- `jackal-adventures` (recommended if this is a team/company project)

Use arrow keys to select, then press Enter.

### Step 2: Verify the Configuration

After `eas init` completes, check [app.json](app.json). You should see:

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
      }
    },
    "owner": "emaanidev"  // or "jackal-adventures"
  }
}
```

The `projectId` should now be a valid UUID (not a placeholder).

### Step 3: Verify EAS Project Info

Run this to confirm:

```bash
eas project:info
```

Expected output:
```
Project: safari-ops-mobile
Project ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Owner: emaanidev (or jackal-adventures)
```

### Step 4: Test the Fix

Once the projectId is set, you can verify the notification service will work:

1. The service will now successfully read the projectId from `Constants.easConfig`
2. The validation functions will pass
3. Push notification registration will work

## What Happens After Setup

Once you complete `eas init`, the code I've implemented will:

1. ✅ Read the valid projectId from [app.json](app.json) at runtime
2. ✅ Validate it's a proper UUID format
3. ✅ Use it when calling `Notifications.getExpoPushTokenAsync()`
4. ✅ Successfully generate Expo push tokens
5. ✅ Save tokens to Supabase database

## Next Steps After EAS Init

After completing `eas init`:

### 1. Create Development Build

```bash
# For iOS
eas build --profile development --platform ios

# For Android
eas build --profile development --platform android
```

### 2. Create eas.json (if needed)

If `eas build` asks for `eas.json`, create it:

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

### 3. Install on Physical Device

- Download build from Expo dashboard
- Install on physical iOS or Android device
- **Do NOT use Expo Go or simulators**

### 4. Test Push Notifications

1. Open app on physical device
2. Login with credentials
3. Grant notification permissions
4. Check console logs for:
   ```
   [PushNotifications] Using EAS projectId: <your-uuid>
   [PushNotifications] Push token obtained: ExponentPushToken[...]
   [PushNotifications] Push token saved successfully
   ```

## Troubleshooting

### "Project already linked" Error

If you see:
```
Project already linked (ID: REPLACE_WITH_YOUR_EAS_PROJECT_ID)
```

This means [app.json](app.json) has an invalid placeholder. Solution:
1. I've already removed the placeholder from [app.json](app.json)
2. Just run `eas init` again

### "Input is required, but stdin is not readable"

This means `eas init` needs to be run in an interactive terminal (not automated). Solution:
1. Open a new terminal window (Command Prompt, PowerShell, or Windows Terminal)
2. Navigate to project directory
3. Run `eas init` there

### Can't Choose Account

If you're not sure which account to use:
- **Personal project:** Choose `emaanidev`
- **Company/team project:** Choose `jackal-adventures`

You can always change this later in the Expo dashboard.

## Summary

**Current blockers:**
- ⏳ Need to run `eas init` interactively to generate projectId

**How to proceed:**
1. Open a terminal
2. Run `eas init`
3. Select account (emaanidev or jackal-adventures)
4. Verify [app.json](app.json) has valid UUID
5. Create development build with `eas build`
6. Test on physical device

**The code is ready** - just needs the projectId configuration!

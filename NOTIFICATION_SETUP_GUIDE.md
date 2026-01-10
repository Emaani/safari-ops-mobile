# Push Notifications - Quick Setup Guide

## Quick Start (5 Steps)

### Step 1: Run Database Migration

1. Open your Supabase project: https://supabase.com/dashboard
2. Go to SQL Editor
3. Copy and paste the entire contents of [`database/migrations/notifications_setup.sql`](database/migrations/notifications_setup.sql)
4. Click "Run"
5. Verify success - you should see "SUCCESS" messages for each table created

### Step 2: Get Your Expo Project ID

```bash
# Login to Expo (if not already logged in)
npx expo login

# Initialize EAS (if not already done)
npx eas init

# Your project ID will be shown and added to app.json
```

**OR** manually get it from: https://expo.dev/accounts/[your-account]/projects/safari-ops-mobile

### Step 3: Update Configuration Files

#### A. Update `app.json` (line 59)
```json
"extra": {
  "eas": {
    "projectId": "your-actual-expo-project-id-here"
  }
}
```

#### B. Update `src/services/notificationService.ts` (line 42)
```typescript
const tokenData = await Notifications.getExpoPushTokenAsync({
  projectId: 'your-actual-expo-project-id-here', // Same as above
});
```

### Step 4: Restart the App

```bash
# Clear Metro cache and restart
npx expo start --clear
```

### Step 5: Test on Physical Device

1. Install Expo Go app on your phone (iOS/Android)
2. Scan the QR code from the terminal
3. Login to the app
4. Grant notification permissions when prompted
5. Check console logs for:
   ```
   [App] Initializing push notifications for user: <uuid>
   [App] Push token obtained, saving to database
   [PushNotifications] Push token saved successfully
   ```

## Test Notification

Once setup is complete, test by creating a notification in Supabase:

```sql
-- Replace 'USER_UUID_HERE' with actual user ID from auth.users
SELECT create_test_notification('USER_UUID_HERE');
```

You should see:
1. Notification appears in app immediately (if app is open)
2. Push notification on device (if app is closed/background)
3. Badge count updates on bell icon

## Troubleshooting

### "Push notifications only work on physical devices"
- This is expected - simulators don't support push notifications
- Use a real iOS or Android device

### "Notification permissions denied"
- Go to device Settings > Notifications > Expo Go (or your app)
- Enable notifications

### "No push token in database"
- Check console logs for errors
- Verify user is logged in
- Try logout and login again

### "Notifications not appearing"
- Verify database migration ran successfully
- Check Supabase RLS policies are enabled
- Verify real-time subscriptions are working
- Pull down to refresh the NotificationsScreen

## What's Next?

Once basic setup works:

1. **Configure Firebase** (Android only) - See [PUSH_NOTIFICATIONS_IMPLEMENTATION.md](PUSH_NOTIFICATIONS_IMPLEMENTATION.md#step-5-configure-firebase-android-only)
2. **Set up Backend Integration** - Connect Web app to create notifications
3. **Customize Notification Icons** - Add custom icons to `assets/`
4. **Add Notification Preferences UI** - Let users configure notification types
5. **Test Production Build** - Build standalone app and test

## Full Documentation

For complete details, see: [PUSH_NOTIFICATIONS_IMPLEMENTATION.md](PUSH_NOTIFICATIONS_IMPLEMENTATION.md)

## Support

If you encounter issues:
1. Check the [Troubleshooting](#troubleshooting) section above
2. Review console logs for error messages
3. Verify all steps were completed correctly
4. Check Supabase database for push_tokens table entries

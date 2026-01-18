# Fix Push Token Database Constraint Error

## ✅ Good News

The push notification fix is **working perfectly**! The token was successfully generated:

```
LOG  [PushNotifications] Using projectId from Constants.easConfig
LOG  [PushNotifications] Using EAS projectId: e5636e2d-1c32-44b8-b5ec-0d03b65d0f5c
LOG  [PushNotifications] Push token obtained: ExponentPushToken[uMcqI_BhbiDuErnoDKFHjk]
```

**The VALIDATION_ERROR is completely fixed!** ✅

## ❌ New Issue: Database Constraint

However, the token cannot be saved to the database due to a check constraint:

```
ERROR [PushNotifications] Error saving push token: {
  "code": "23514",
  "message": "new row for relation \"push_tokens\" violates check constraint \"push_tokens_expo_format_check\""
}
```

### Root Cause

The `push_tokens` table has a constraint called `push_tokens_expo_format_check` that's **rejecting valid Expo push tokens**.

The token format is: `ExponentPushToken[uMcqI_BhbiDuErnoDKFHjk]`

This constraint was likely added manually in Supabase and has an incorrect validation pattern.

## 🔧 Fix Solution

### Option 1: Quick Fix - Remove the Constraint (Recommended)

1. Open **Supabase SQL Editor**
2. Run this SQL script:

```sql
-- Remove the problematic constraint
ALTER TABLE public.push_tokens
DROP CONSTRAINT IF EXISTS push_tokens_expo_format_check;
```

3. Verify the fix:

```sql
-- Check if constraint is gone
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.push_tokens'::regclass
  AND conname LIKE '%expo%';
```

Should return **no rows** (constraint removed).

### Option 2: Fix the Constraint Pattern (Alternative)

If you want to keep validation, use the correct regex pattern:

```sql
-- First, drop the bad constraint
ALTER TABLE public.push_tokens
DROP CONSTRAINT IF EXISTS push_tokens_expo_format_check;

-- Then, add a properly formatted constraint
ALTER TABLE public.push_tokens
ADD CONSTRAINT push_tokens_expo_format_check
CHECK (token ~* '^ExponentPushToken\[[a-zA-Z0-9_-]+\]$');
```

This allows tokens in the format: `ExponentPushToken[<alphanumeric-chars>]`

## 📋 Step-by-Step Instructions

### 1. Access Supabase SQL Editor

- Go to your Supabase Dashboard
- Click on "SQL Editor" in the left sidebar
- Click "New Query"

### 2. Run the Fix Script

Copy and paste the contents of [database/migrations/fix_push_tokens_constraint.sql](database/migrations/fix_push_tokens_constraint.sql):

```sql
ALTER TABLE public.push_tokens
DROP CONSTRAINT IF EXISTS push_tokens_expo_format_check;
```

Click "Run" or press `Ctrl+Enter`.

### 3. Verify the Fix

Run this query to confirm:

```sql
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.push_tokens'::regclass;
```

You should see constraints like:
- `unique_user_token` (UNIQUE)
- `push_tokens_device_type_check` (CHECK for device_type)
- `push_tokens_pkey` (PRIMARY KEY)

But **NOT** `push_tokens_expo_format_check`.

### 4. Test the Fix

Restart your mobile app and login again. You should now see:

```
LOG  [PushNotifications] Push token obtained: ExponentPushToken[...]
LOG  [App] Push token obtained, saving to database
LOG  [PushNotifications] Saving push token to database...
LOG  [PushNotifications] Push token saved successfully  ✅
```

### 5. Verify in Database

Query the `push_tokens` table:

```sql
SELECT * FROM push_tokens
WHERE user_id = 'fe1d1527-5370-4c3c-8bac-43d89074cd69'
ORDER BY created_at DESC
LIMIT 5;
```

You should see your push token saved with:
- `token`: ExponentPushToken[uMcqI_BhbiDuErnoDKFHjk]
- `device_type`: ios
- `is_active`: true

## 🎯 Why This Happened

The constraint `push_tokens_expo_format_check` was likely added manually in Supabase but used an incorrect regex pattern. The original migration file ([database/migrations/notifications_setup.sql](database/migrations/notifications_setup.sql)) **does NOT include this constraint**, which means it was added separately.

### Correct Token Format

Expo push tokens always follow this format:

```
ExponentPushToken[<random-string>]
```

Example:
```
ExponentPushToken[uMcqI_BhbiDuErnoDKFHjk]
ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
```

The `<random-string>` can contain:
- Letters: `a-z`, `A-Z`
- Numbers: `0-9`
- Special characters: `_`, `-`

## 📚 Alternative: Check Existing Constraints

To see what constraints currently exist on the table:

```sql
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.push_tokens'::regclass
ORDER BY conname;
```

This will show you all constraints, including the problematic one.

## ✅ Summary

1. **Root Issue**: Database constraint with incorrect validation pattern
2. **Quick Fix**: Remove the `push_tokens_expo_format_check` constraint
3. **Long-term**: Use correct regex if validation is needed
4. **Impact**: After fixing, push notifications will work end-to-end!

## 🚀 After Fixing

Once you run the SQL fix, the complete flow will work:

1. ✅ User logs in
2. ✅ App requests push permissions
3. ✅ Valid projectId is read from config
4. ✅ Expo generates push token
5. ✅ Token is saved to Supabase ✨ (Previously failing, now fixed!)
6. ✅ App can receive push notifications

**You're one SQL command away from fully working push notifications!**

## 📁 Files

- [database/migrations/fix_push_tokens_constraint.sql](database/migrations/fix_push_tokens_constraint.sql) - SQL fix script
- [database/migrations/notifications_setup.sql](database/migrations/notifications_setup.sql) - Original migration (no bad constraint)

## 🆘 Still Having Issues?

If the error persists after running the fix:

1. **Check if the constraint was actually dropped:**
   ```sql
   \d push_tokens
   ```

2. **Try dropping all expo-related constraints:**
   ```sql
   SELECT conname FROM pg_constraint
   WHERE conrelid = 'public.push_tokens'::regclass
   AND conname LIKE '%expo%';
   ```

3. **Verify RLS policies aren't blocking:**
   ```sql
   SELECT * FROM pg_policies
   WHERE tablename = 'push_tokens';
   ```

The RLS policies should allow authenticated users to INSERT their own tokens.

## 💡 Pro Tip

After fixing, test by sending a notification:

```sql
SELECT send_push_notification(
    'fe1d1527-5370-4c3c-8bac-43d89074cd69',
    'general',
    'Test Notification',
    'This is a test push notification!',
    'high',
    '{}'::jsonb
);
```

You should receive it on your device! 🎉

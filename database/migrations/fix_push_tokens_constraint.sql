-- ============================================================================
-- FIX PUSH_TOKENS CONSTRAINT
-- ============================================================================
-- This script fixes the push_tokens table constraint that's causing validation errors
--
-- Error: new row for relation "push_tokens" violates check constraint "push_tokens_expo_format_check"
--
-- The token format from Expo is: ExponentPushToken[xxxxxxxxxxxxx]
-- We need to ensure the constraint allows this format OR remove the constraint entirely
-- ============================================================================

-- Option 1: Drop the existing constraint if it exists
ALTER TABLE public.push_tokens
DROP CONSTRAINT IF EXISTS push_tokens_expo_format_check;

-- Option 2: Add a proper constraint that validates Expo push token format
-- Uncomment this if you want to keep validation:
/*
ALTER TABLE public.push_tokens
ADD CONSTRAINT push_tokens_expo_format_check
CHECK (token ~* '^ExponentPushToken\[[a-zA-Z0-9_-]+\]$');
*/

-- Verify the constraint is removed
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.push_tokens'::regclass
  AND conname LIKE '%expo%';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this script, test by inserting a token:
/*
INSERT INTO public.push_tokens (user_id, token, device_type, device_name)
VALUES (
  auth.uid(),
  'ExponentPushToken[uMcqI_BhbiDuErnoDKFHjk]',
  'ios',
  'Test Device'
);
*/
-- ============================================================================

COMMENT ON TABLE public.push_tokens IS 'Stores Expo push tokens. Token format: ExponentPushToken[xxxxx]';

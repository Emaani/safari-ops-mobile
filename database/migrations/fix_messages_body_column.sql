-- ============================================================================
-- FIX: Normalise the messages table to use 'body' as the message text column
-- ============================================================================
-- The live table was created with column name "message" (NOT NULL).
-- A previous migration attempt added an empty "body" column (DEFAULT '').
-- This migration:
--   1. Drops the empty 'body' column we added
--   2. Renames 'message' → 'body' so the app code aligns with the schema
--   3. Ensures all other required columns exist
--   4. Locks in RLS policies and the append_message_reader RPC
-- ============================================================================

-- Step 1: Drop the empty placeholder column added by the previous migration
ALTER TABLE public.messages DROP COLUMN IF EXISTS body;

-- Step 2: Rename the real message-text column to 'body'
-- (skip if it was already renamed or if the column is called something else)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'messages'
      AND column_name  = 'message'
  ) THEN
    ALTER TABLE public.messages RENAME COLUMN message TO body;
  END IF;
END $$;

-- Step 3: Make sure body has the right constraint
ALTER TABLE public.messages ALTER COLUMN body SET NOT NULL;
ALTER TABLE public.messages ALTER COLUMN body DROP DEFAULT;

-- Step 4: Add other columns if missing
ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS sender_name TEXT NOT NULL DEFAULT 'Staff';

ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS read_by UUID[] NOT NULL DEFAULT '{}';

-- Step 5: Indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender_id    ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at   ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_broadcast    ON public.messages(created_at DESC)
    WHERE recipient_id IS NULL;

-- Step 6: RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read visible messages" ON public.messages;
CREATE POLICY "Users can read visible messages"
    ON public.messages FOR SELECT
    USING (
        auth.uid() IS NOT NULL
        AND (
            recipient_id IS NULL
            OR sender_id = auth.uid()
            OR recipient_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can send own messages" ON public.messages;
CREATE POLICY "Users can send own messages"
    ON public.messages FOR INSERT
    WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can update readable messages" ON public.messages;
CREATE POLICY "Users can update readable messages"
    ON public.messages FOR UPDATE
    USING (
        auth.uid() IS NOT NULL
        AND (
            recipient_id IS NULL
            OR sender_id = auth.uid()
            OR recipient_id = auth.uid()
        )
    );

-- Step 7: append_message_reader RPC
CREATE OR REPLACE FUNCTION public.append_message_reader(
    p_message_id UUID,
    p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    IF p_user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Cannot mark messages read for another user';
    END IF;

    UPDATE public.messages
    SET read_by = (
        SELECT ARRAY(
            SELECT DISTINCT reader
            FROM unnest(read_by || p_user_id) AS reader
        )
    )
    WHERE id = p_message_id
      AND (
        recipient_id IS NULL
        OR sender_id = auth.uid()
        OR recipient_id = auth.uid()
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

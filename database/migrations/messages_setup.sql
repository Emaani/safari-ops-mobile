-- ============================================================================
-- SAFARI OPS MOBILE - STAFF MESSAGES DATABASE SCHEMA
-- ============================================================================
-- Enables broadcast and direct staff messages from the Notifications screen.
-- Run this once in Supabase SQL Editor if the messages table is not present.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_name TEXT NOT NULL DEFAULT 'Staff',
    body TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    read_by UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_broadcast ON public.messages(created_at DESC)
    WHERE recipient_id IS NULL;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read visible messages" ON public.messages;
CREATE POLICY "Users can read visible messages"
    ON public.messages
    FOR SELECT
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
    ON public.messages
    FOR INSERT
    WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can update readable messages" ON public.messages;
CREATE POLICY "Users can update readable messages"
    ON public.messages
    FOR UPDATE
    USING (
        auth.uid() IS NOT NULL
        AND (
            recipient_id IS NULL
            OR sender_id = auth.uid()
            OR recipient_id = auth.uid()
        )
    );

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

COMMENT ON TABLE public.messages IS 'Broadcast and direct staff messages for Safari Ops Mobile';
COMMENT ON FUNCTION public.append_message_reader IS 'Adds the current user to a message read_by list';

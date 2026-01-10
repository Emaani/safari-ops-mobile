-- ============================================================================
-- SAFARI OPS MOBILE - NOTIFICATIONS DATABASE SCHEMA
-- ============================================================================
-- This script creates all necessary tables, indexes, and triggers for the
-- push notification system that synchronizes with the Web app.
--
-- Tables created:
-- 1. notifications - stores all user notifications
-- 2. push_tokens - stores device push tokens for each user
-- 3. notification_preferences - stores user notification settings
--
-- Run this script in your Supabase SQL Editor or via psql
-- ============================================================================

-- ============================================================================
-- 1. NOTIFICATIONS TABLE
-- ============================================================================
-- Stores all notifications for users
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'booking_created',
        'booking_confirmed',
        'booking_completed',
        'booking_cancelled',
        'payment_received',
        'payment_overdue',
        'cr_created',
        'cr_approved',
        'cr_rejected',
        'vehicle_maintenance',
        'vehicle_available',
        'system_alert',
        'admin_message',
        'general'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    CONSTRAINT valid_read_at CHECK (read_at IS NULL OR read_at >= created_at),
    CONSTRAINT valid_expires_at CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON public.notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON public.notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
    ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read, archive, etc.)
CREATE POLICY "Users can update own notifications"
    ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
    ON public.notifications
    FOR DELETE
    USING (auth.uid() = user_id);

-- Only authenticated users can insert notifications (typically from backend)
CREATE POLICY "Authenticated users can insert notifications"
    ON public.notifications
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- 2. PUSH TOKENS TABLE
-- ============================================================================
-- Stores device push tokens for sending notifications
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_type TEXT NOT NULL CHECK (device_type IN ('ios', 'android', 'web')),
    device_name TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_token UNIQUE (user_id, token)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON public.push_tokens(token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON public.push_tokens(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for push_tokens
CREATE POLICY "Users can view own push tokens"
    ON public.push_tokens
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push tokens"
    ON public.push_tokens
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push tokens"
    ON public.push_tokens
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push tokens"
    ON public.push_tokens
    FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER push_tokens_updated_at
    BEFORE UPDATE ON public.push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_push_tokens_updated_at();

-- ============================================================================
-- 3. NOTIFICATION PREFERENCES TABLE
-- ============================================================================
-- Stores user notification preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    -- Push notification settings
    push_enabled BOOLEAN NOT NULL DEFAULT true,

    -- Notification type preferences
    booking_notifications BOOLEAN NOT NULL DEFAULT true,
    payment_notifications BOOLEAN NOT NULL DEFAULT true,
    cr_notifications BOOLEAN NOT NULL DEFAULT true,
    vehicle_notifications BOOLEAN NOT NULL DEFAULT true,
    system_notifications BOOLEAN NOT NULL DEFAULT true,
    admin_notifications BOOLEAN NOT NULL DEFAULT true,

    -- Quiet hours
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
    quiet_hours_start TIME,
    quiet_hours_end TIME,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);

-- Enable Row Level Security
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_preferences
CREATE POLICY "Users can view own preferences"
    ON public.notification_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
    ON public.notification_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
    ON public.notification_preferences
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notification_preferences_updated_at
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_preferences_updated_at();

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Function to create default notification preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create preferences when a user signs up
CREATE TRIGGER on_auth_user_created_notification_preferences
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_notification_preferences();

-- Function to send push notification (to be called from backend/Edge Functions)
CREATE OR REPLACE FUNCTION send_push_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_priority TEXT DEFAULT 'medium',
    p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
BEGIN
    -- Insert notification into database
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        priority,
        data
    ) VALUES (
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_priority,
        p_data
    ) RETURNING id INTO notification_id;

    RETURN notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.notifications
    SET status = 'read', read_at = NOW()
    WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS VOID AS $$
BEGIN
    UPDATE public.notifications
    SET status = 'read', read_at = NOW()
    WHERE user_id = auth.uid() AND status = 'unread';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Create a test notification function
CREATE OR REPLACE FUNCTION create_test_notification(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
BEGIN
    SELECT send_push_notification(
        p_user_id,
        'system_alert',
        'Welcome to Safari Ops Mobile!',
        'Your notifications are now configured and ready to use.',
        'medium',
        '{"screen": "Dashboard"}'::jsonb
    ) INTO notification_id;

    RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. CLEANUP OLD NOTIFICATIONS (Optional - Scheduled Job)
-- ============================================================================

-- Function to delete old read notifications (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.notifications
    WHERE status = 'read'
        AND read_at < NOW() - INTERVAL '30 days'
        AND (expires_at IS NULL OR expires_at < NOW());

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- To schedule this function, use pg_cron extension or Supabase scheduled functions:
-- SELECT cron.schedule('cleanup-old-notifications', '0 2 * * *', 'SELECT cleanup_old_notifications()');

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE public.notifications IS 'Stores all user notifications for the Safari Ops Mobile app';
COMMENT ON TABLE public.push_tokens IS 'Stores device push tokens for sending notifications via Expo';
COMMENT ON TABLE public.notification_preferences IS 'Stores user notification preferences and settings';
COMMENT ON FUNCTION send_push_notification IS 'Creates a new notification and triggers push notification delivery';
COMMENT ON FUNCTION cleanup_old_notifications IS 'Deletes read notifications older than 30 days';

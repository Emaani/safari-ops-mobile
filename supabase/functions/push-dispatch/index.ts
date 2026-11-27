import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

/**
 * Sends a real OS-level push notification for a single `notifications` row.
 *
 * Invoked by a Postgres trigger (AFTER INSERT ON notifications, via
 * net.http_post — see migration 0001_notifications_push_trigger) so delivery
 * no longer depends on some other device happening to have the app open to
 * relay it. Every notification row — regardless of which feature created it
 * (bookings, cash requisitions, messages, etc.) — flows through here exactly
 * once, so this is the single place that talks to Expo's push API.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type?: string;
  link?: string | null;
}

async function getActiveTokens(userId: string): Promise<string[]> {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/push_tokens?user_id=eq.${userId}&is_active=eq.true&select=token`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!resp.ok) {
    console.error('[push-dispatch] Failed to fetch push tokens:', resp.status, await resp.text());
    return [];
  }
  const rows = (await resp.json()) as Array<{ token: string }>;
  return rows.map((r) => r.token).filter(Boolean);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const payload = await req.json();
    // Postgres trigger sends { record: {...} } (matches Supabase's standard
    // webhook shape); allow a bare row too for direct/manual invocation.
    const record: NotificationRow = payload.record ?? payload;

    if (!record?.user_id || !record?.title) {
      return new Response(JSON.stringify({ error: 'Missing user_id/title' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const tokens = await getActiveTokens(record.user_id);
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_active_tokens' }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const messages = tokens.map((token) => ({
      to: token,
      title: record.title,
      body: record.message,
      sound: 'default',
      priority: 'high',
      channelId: 'default',
      data: { notification_id: record.id, type: record.type, link: record.link },
    }));

    const pushResp = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
    });

    const pushResult = await pushResp.json().catch(() => null);
    if (!pushResp.ok) {
      console.error('[push-dispatch] Expo push API error:', pushResp.status, pushResult);
    }

    return new Response(JSON.stringify({ sent: tokens.length, result: pushResult }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[push-dispatch] Unhandled error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});

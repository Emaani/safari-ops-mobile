/**
 * useMessages
 *
 * Fetches staff broadcast messages from the `messages` table and keeps them
 * live via a dedicated Supabase Realtime channel.  The same table is used by
 * the web app, so any message posted there appears here immediately.
 *
 * Table schema (run once in Supabase SQL editor):
 *
 *   create table if not exists public.messages (
 *     id           uuid primary key default gen_random_uuid(),
 *     sender_id    uuid not null references auth.users(id) on delete cascade,
 *     sender_name  text not null default 'Unknown',
 *     body         text not null,
 *     recipient_id uuid references auth.users(id) on delete cascade,
 *     read_by      uuid[] not null default '{}',
 *     created_at   timestamptz not null default now()
 *   );
 *
 *   -- RLS: authenticated users can read all broadcast messages
 *   alter table public.messages enable row level security;
 *   create policy "read_messages" on public.messages for select using (auth.uid() is not null);
 *   create policy "insert_messages" on public.messages for insert with check (auth.uid() = sender_id);
 *   create policy "update_read_by" on public.messages for update using (auth.uid() is not null);
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { devLog } from '../lib/devLog';
import { createNotification, resolveUserByEmail } from '../services/notificationService';
import type { Message, SendMessagePayload } from '../types/message';

// ─── Column name detection ────────────────────────────────────────────────────
// The live Supabase table column for message text may be named 'body',
// 'message', or 'content' depending on when the table was created.
// We probe the actual column order: message → body → content → text.
// normaliseMessage always maps whichever one exists to the .body field.
function normaliseMessage(row: Record<string, any>): Message {
  return {
    id:              row.id,
    sender_id:       row.sender_id,
    sender_name:     row.sender_name || 'Staff',
    body:            row.body ?? row.message ?? row.content ?? row.text ?? '',
    recipient_id:    row.recipient_id ?? null,
    recipient_email: row.recipient_email ?? null,
    read_by:         row.read_by ?? [],
    created_at:      row.created_at,
  };
}

// Probe order: 'message' is the confirmed live column name; 'body' is the
// target after renaming; 'content' is a common alternative.
// Cache resets if an insert returns a not-null constraint error so we re-probe.
let _resolvedBodyCol: string | null = null;
export function resetBodyColumnCache() { _resolvedBodyCol = null; }

async function resolveBodyColumn(): Promise<string> {
  if (_resolvedBodyCol) return _resolvedBodyCol;
  // Probe in order of likelihood based on the live schema
  for (const col of ['message', 'body', 'content', 'text']) {
    const { error } = await supabase.from('messages').select(col).limit(1);
    if (!error) {
      devLog(`[Messages] resolved body column: ${col}`);
      _resolvedBodyCol = col;
      return col;
    }
  }
  // Last-resort fallback
  _resolvedBodyCol = 'body';
  return 'body';
}

interface UseMessagesReturn {
  messages: Message[];
  loading: boolean;
  error: Error | null;
  sending: boolean;
  sendMessage: (payload: SendMessagePayload) => Promise<void>;
  markRead: (messageId: string) => Promise<void>;
  refresh: () => Promise<void>;
  unreadCount: number;
}

export function useMessages(
  userId: string,
  senderName: string,
): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState<Error | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Fetch all broadcast messages ──────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error: err } = await supabase
        .from('messages')
        .select('*')
        // Show broadcasts (no recipient) OR messages sent/received by this user
        .or(`recipient_id.is.null,sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: true })
        .limit(200);

      if (err) {
        // Table not yet created — surface a clean state
        if (err.code === '42P01' || err.message?.includes('does not exist')) {
          setMessages([]);
          setError(null);
          setLoading(false);
          return;
        }
        throw err;
      }

      setMessages((data || []).map(normaliseMessage));
      setError(null);
    } catch (e: any) {
      console.error('[Messages] fetch error:', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchMessages();

    devLog('[Messages] subscribing to realtime');
    const channel = supabase
      .channel(`messages-broadcast`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          devLog('[Messages] realtime:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            const msg = normaliseMessage(payload.new as Record<string, any>);
            // Only show broadcast or messages involving this user
            const isRelevant =
              msg.recipient_id === null ||
              msg.sender_id === userId ||
              msg.recipient_id === userId;
            if (!isRelevant) return;
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = normaliseMessage(payload.new as Record<string, any>);
            setMessages((prev) =>
              prev.map((m) => (m.id === updated.id ? updated : m))
            );
          } else if (payload.eventType === 'DELETE') {
            const id = (payload.old as Partial<Message>).id;
            if (id) setMessages((prev) => prev.filter((m) => m.id !== id));
          }
        }
      )
      .subscribe((status) => {
        devLog(`[Messages] channel status: ${status}`);
      });

    channelRef.current = channel;

    return () => {
      devLog('[Messages] unsubscribing');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, fetchMessages]);

  // ── Send a message ────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async ({ body, recipient_id = null, recipient_email = null }: SendMessagePayload) => {
      if (!userId || !body.trim()) return;
      setSending(true);
      try {
        let resolvedRecipientId = recipient_id;
        let resolvedRecipientEmail = recipient_email?.trim().replace(/^@/, '').toLowerCase() || null;

        if (!resolvedRecipientId && resolvedRecipientEmail) {
          const recipient = await resolveUserByEmail(resolvedRecipientEmail);
          if (!recipient) {
            throw new Error(`No user found for ${resolvedRecipientEmail}`);
          }
          resolvedRecipientId = recipient.id;
          resolvedRecipientEmail = recipient.email || resolvedRecipientEmail;
        }

        const bodyCol = await resolveBodyColumn();
        const insertRow = {
          sender_id:    userId,
          sender_name:  senderName || 'Staff',
          [bodyCol]:    body.trim(),
          recipient_id: resolvedRecipientId,
          read_by:      [userId],
        };
        let { error: err } = await supabase.from('messages').insert(insertRow);

        // If we hit a NOT NULL constraint it means our cached column name is
        // wrong (e.g. schema was renamed). Reset the cache and retry once.
        if (err && (err.code === '23502' || err.message?.includes('not-null'))) {
          devLog('[Messages] not-null error — resetting column cache and retrying');
          resetBodyColumnCache();
          const retryCol = await resolveBodyColumn();
          const retryRow = {
            sender_id:    userId,
            sender_name:  senderName || 'Staff',
            [retryCol]:   body.trim(),
            recipient_id: resolvedRecipientId,
            read_by:      [userId],
          };
          const { error: retryErr } = await supabase.from('messages').insert(retryRow);
          err = retryErr;
        }

        if (err) throw err;

        if (resolvedRecipientId && resolvedRecipientId !== userId) {
          await createNotification({
            userId: resolvedRecipientId,
            type: 'admin_message',
            title: `Message from ${senderName || 'Staff'}`,
            message: body.trim(),
            priority: 'medium',
            data: {
              screen: 'Messages',
              type: 'admin_message',
              initialTab: 'messages',
              sender_id: userId,
              recipient_email: resolvedRecipientEmail,
            },
          }).catch((notificationError) => {
            console.error('[Messages] notification create error:', notificationError);
          });
        }
      } catch (e: any) {
        console.error('[Messages] send error:', e);
        throw e;
      } finally {
        setSending(false);
      }
    },
    [userId, senderName]
  );

  // ── Mark a message as read by current user ────────────────────────────────
  const markRead = useCallback(
    async (messageId: string) => {
      if (!userId) return;
      const msg = messages.find((m) => m.id === messageId);
      if (!msg || msg.read_by?.includes(userId)) return;

      // Optimistic
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, read_by: [...(m.read_by || []), userId] }
            : m
        )
      );

      const { error: rpcErr } = await supabase.rpc('append_message_reader', {
        p_message_id: messageId,
        p_user_id:    userId,
      });
      if (rpcErr) {
        // Fallback: direct update
        await supabase
          .from('messages')
          .update({ read_by: [...(msg.read_by || []), userId] })
          .eq('id', messageId);
      }
    },
    [userId, messages]
  );

  const unreadCount = messages.filter(
    (m) => m.sender_id !== userId && !(m.read_by || []).includes(userId)
  ).length;

  return {
    messages,
    loading,
    error,
    sending,
    sendMessage,
    markRead,
    refresh: fetchMessages,
    unreadCount,
  };
}

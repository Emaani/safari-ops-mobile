/**
 * useMessaging Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { JackalSDK } from '../core/JackalSDK';
import type { Message, MessageChannel } from '../messaging/MessagingService';

export function useMessaging(channelId?: string) {
  const sdk = JackalSDK.getInstance();
  const [messages, setMessages] = useState<Message[]>([]);
  const [channels, setChannels] = useState<MessageChannel[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [channelsData, unread] = await Promise.all([
          sdk.messaging.getChannels(),
          sdk.messaging.getUnreadCount(),
        ]);

        setChannels(channelsData);
        setUnreadCount(unread);

        if (channelId) {
          const messagesData = await sdk.messaging.getMessages({ channelId });
          setMessages(messagesData);
        }
      } catch (error) {
        sdk.logger.error('[useMessaging] Error fetching data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [channelId]);

  useEffect(() => {
    if (!channelId) return;

    const unsubscribe = sdk.messaging.subscribeToChannel(channelId, (message) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => unsubscribe();
  }, [channelId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!channelId) return;

    const message = await sdk.messaging.sendMessage(channelId, content);
    setMessages((prev) => [...prev, message]);
    return message;
  }, [channelId]);

  const markAsRead = useCallback(async (messageId: string) => {
    await sdk.messaging.markAsRead(messageId);
    const unread = await sdk.messaging.getUnreadCount();
    setUnreadCount(unread);
  }, []);

  return {
    messages,
    channels,
    unreadCount,
    loading,
    sendMessage,
    markAsRead,
  };
}

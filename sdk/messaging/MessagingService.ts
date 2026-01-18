/**
 * Messaging Service
 *
 * Handles in-app messaging, chat, and real-time message delivery
 */

import type { Logger } from '../utils/Logger';
import type { AuthService } from '../auth/AuthService';
import type { APIService } from '../api/APIService';
import type { StorageService } from '../storage/StorageService';

export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  senderName?: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt?: Date;
  readBy?: string[];
}

export interface MessageChannel {
  id: string;
  name: string;
  type: 'direct' | 'group' | 'broadcast';
  participants: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt?: Date;
  lastMessage?: Message;
  unreadCount?: number;
}

export interface MessageSubscription {
  channelId: string;
  callback: (message: Message) => void;
  unsubscribe: () => void;
}

export interface MessageFilter {
  channelId?: string;
  senderId?: string;
  type?: Message['type'];
  before?: Date;
  after?: Date;
  limit?: number;
  offset?: number;
}

export class MessagingService {
  private logger: Logger;
  private auth: AuthService;
  private api: APIService;
  private storage: StorageService;
  private subscriptions: Map<string, MessageSubscription[]> = new Map();

  constructor(config: {
    logger: Logger;
    auth: AuthService;
    api: APIService;
    storage: StorageService;
  }) {
    this.logger = config.logger;
    this.auth = config.auth;
    this.api = config.api;
    this.storage = config.storage;
  }

  /**
   * Send a message to a channel
   */
  public async sendMessage(
    channelId: string,
    content: string,
    type: Message['type'] = 'text',
    metadata?: Record<string, any>
  ): Promise<Message> {
    this.logger.info('[Messaging] Sending message to channel:', channelId);

    try {
      const user = await this.auth.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const response = await this.api.post<Message>('/messages', {
        channel_id: channelId,
        sender_id: user.id,
        content,
        type,
        metadata,
      });

      this.logger.info('[Messaging] Message sent successfully');
      return response.data;
    } catch (error) {
      this.logger.error('[Messaging] Error sending message', error);
      throw error;
    }
  }

  /**
   * Get messages from a channel
   */
  public async getMessages(filter: MessageFilter): Promise<Message[]> {
    this.logger.info('[Messaging] Getting messages with filter:', filter);

    try {
      const params = new URLSearchParams();
      if (filter.channelId) params.append('channel_id', filter.channelId);
      if (filter.senderId) params.append('sender_id', filter.senderId);
      if (filter.type) params.append('type', filter.type);
      if (filter.before) params.append('before', filter.before.toISOString());
      if (filter.after) params.append('after', filter.after.toISOString());
      if (filter.limit) params.append('limit', filter.limit.toString());
      if (filter.offset) params.append('offset', filter.offset.toString());

      const response = await this.api.get<Message[]>(`/messages?${params.toString()}`);
      return response.data;
    } catch (error) {
      this.logger.error('[Messaging] Error getting messages', error);
      throw error;
    }
  }

  /**
   * Get a single message by ID
   */
  public async getMessage(messageId: string): Promise<Message> {
    this.logger.info('[Messaging] Getting message:', messageId);

    try {
      const response = await this.api.get<Message>(`/messages/${messageId}`);
      return response.data;
    } catch (error) {
      this.logger.error('[Messaging] Error getting message', error);
      throw error;
    }
  }

  /**
   * Update a message
   */
  public async updateMessage(
    messageId: string,
    updates: Partial<Pick<Message, 'content' | 'metadata'>>
  ): Promise<Message> {
    this.logger.info('[Messaging] Updating message:', messageId);

    try {
      const response = await this.api.patch<Message>(`/messages/${messageId}`, updates);
      return response.data;
    } catch (error) {
      this.logger.error('[Messaging] Error updating message', error);
      throw error;
    }
  }

  /**
   * Delete a message
   */
  public async deleteMessage(messageId: string): Promise<void> {
    this.logger.info('[Messaging] Deleting message:', messageId);

    try {
      await this.api.delete(`/messages/${messageId}`);
    } catch (error) {
      this.logger.error('[Messaging] Error deleting message', error);
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  public async markAsRead(messageId: string): Promise<void> {
    this.logger.info('[Messaging] Marking message as read:', messageId);

    try {
      const user = await this.auth.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      await this.api.post(`/messages/${messageId}/read`, {
        user_id: user.id,
      });
    } catch (error) {
      this.logger.error('[Messaging] Error marking message as read', error);
      throw error;
    }
  }

  /**
   * Mark all messages in a channel as read
   */
  public async markChannelAsRead(channelId: string): Promise<void> {
    this.logger.info('[Messaging] Marking channel as read:', channelId);

    try {
      const user = await this.auth.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      await this.api.post(`/channels/${channelId}/read`, {
        user_id: user.id,
      });
    } catch (error) {
      this.logger.error('[Messaging] Error marking channel as read', error);
      throw error;
    }
  }

  /**
   * Create a new message channel
   */
  public async createChannel(
    name: string,
    type: MessageChannel['type'],
    participants: string[],
    metadata?: Record<string, any>
  ): Promise<MessageChannel> {
    this.logger.info('[Messaging] Creating channel:', name);

    try {
      const response = await this.api.post<MessageChannel>('/channels', {
        name,
        type,
        participants,
        metadata,
      });

      return response.data;
    } catch (error) {
      this.logger.error('[Messaging] Error creating channel', error);
      throw error;
    }
  }

  /**
   * Get user's channels
   */
  public async getChannels(): Promise<MessageChannel[]> {
    this.logger.info('[Messaging] Getting channels');

    try {
      const user = await this.auth.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const response = await this.api.get<MessageChannel[]>(`/channels?user_id=${user.id}`);
      return response.data;
    } catch (error) {
      this.logger.error('[Messaging] Error getting channels', error);
      throw error;
    }
  }

  /**
   * Get a specific channel
   */
  public async getChannel(channelId: string): Promise<MessageChannel> {
    this.logger.info('[Messaging] Getting channel:', channelId);

    try {
      const response = await this.api.get<MessageChannel>(`/channels/${channelId}`);
      return response.data;
    } catch (error) {
      this.logger.error('[Messaging] Error getting channel', error);
      throw error;
    }
  }

  /**
   * Update a channel
   */
  public async updateChannel(
    channelId: string,
    updates: Partial<Pick<MessageChannel, 'name' | 'metadata'>>
  ): Promise<MessageChannel> {
    this.logger.info('[Messaging] Updating channel:', channelId);

    try {
      const response = await this.api.patch<MessageChannel>(`/channels/${channelId}`, updates);
      return response.data;
    } catch (error) {
      this.logger.error('[Messaging] Error updating channel', error);
      throw error;
    }
  }

  /**
   * Add participant to channel
   */
  public async addParticipant(channelId: string, userId: string): Promise<void> {
    this.logger.info('[Messaging] Adding participant to channel:', channelId);

    try {
      await this.api.post(`/channels/${channelId}/participants`, {
        user_id: userId,
      });
    } catch (error) {
      this.logger.error('[Messaging] Error adding participant', error);
      throw error;
    }
  }

  /**
   * Remove participant from channel
   */
  public async removeParticipant(channelId: string, userId: string): Promise<void> {
    this.logger.info('[Messaging] Removing participant from channel:', channelId);

    try {
      await this.api.delete(`/channels/${channelId}/participants/${userId}`);
    } catch (error) {
      this.logger.error('[Messaging] Error removing participant', error);
      throw error;
    }
  }

  /**
   * Subscribe to messages in a channel
   */
  public subscribeToChannel(
    channelId: string,
    callback: (message: Message) => void
  ): () => void {
    this.logger.info('[Messaging] Subscribing to channel:', channelId);

    const subscription: MessageSubscription = {
      channelId,
      callback,
      unsubscribe: () => {
        const subs = this.subscriptions.get(channelId) || [];
        const index = subs.indexOf(subscription);
        if (index > -1) {
          subs.splice(index, 1);
        }
        if (subs.length === 0) {
          this.subscriptions.delete(channelId);
        }
      },
    };

    const existingSubs = this.subscriptions.get(channelId) || [];
    existingSubs.push(subscription);
    this.subscriptions.set(channelId, existingSubs);

    return subscription.unsubscribe;
  }

  /**
   * Notify subscribers of a new message
   */
  private notifySubscribers(message: Message): void {
    const subs = this.subscriptions.get(message.channelId) || [];
    subs.forEach((sub) => {
      try {
        sub.callback(message);
      } catch (error) {
        this.logger.error('[Messaging] Error in message subscription callback', error);
      }
    });
  }

  /**
   * Get unread message count
   */
  public async getUnreadCount(channelId?: string): Promise<number> {
    this.logger.info('[Messaging] Getting unread count');

    try {
      const user = await this.auth.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const url = channelId
        ? `/messages/unread?user_id=${user.id}&channel_id=${channelId}`
        : `/messages/unread?user_id=${user.id}`;

      const response = await this.api.get<{ count: number }>(url);
      return response.data.count;
    } catch (error) {
      this.logger.error('[Messaging] Error getting unread count', error);
      throw error;
    }
  }

  /**
   * Search messages
   */
  public async searchMessages(query: string, channelId?: string): Promise<Message[]> {
    this.logger.info('[Messaging] Searching messages:', query);

    try {
      const params = new URLSearchParams();
      params.append('q', query);
      if (channelId) params.append('channel_id', channelId);

      const response = await this.api.get<Message[]>(`/messages/search?${params.toString()}`);
      return response.data;
    } catch (error) {
      this.logger.error('[Messaging] Error searching messages', error);
      throw error;
    }
  }
}

/**
 * Realtime Service
 *
 * Handles real-time data synchronization using Supabase Realtime
 */

import { createClient, RealtimeChannel as SupabaseChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from '../utils/Logger';
import type { AuthService } from '../auth/AuthService';

export interface RealtimeConfig {
  supabaseUrl: string;
  supabaseKey: string;
  logger: Logger;
  auth: AuthService;
}

export interface RealtimeChannel {
  id: string;
  name: string;
  topic: string;
  subscription: SupabaseChannel;
}

export interface RealtimeEvent<T = any> {
  type: 'INSERT' | 'UPDATE' | 'DELETE' | 'BROADCAST' | 'PRESENCE';
  table?: string;
  schema?: string;
  oldRecord?: T;
  newRecord?: T;
  payload?: any;
  timestamp: Date;
}

export interface RealtimeSubscription<T = any> {
  channelId: string;
  callback: (event: RealtimeEvent<T>) => void;
  unsubscribe: () => Promise<void>;
}

export class RealtimeService {
  private logger: Logger;
  private auth: AuthService;
  private supabase: SupabaseClient;
  private channels: Map<string, RealtimeChannel> = new Map();
  private subscriptions: Map<string, RealtimeSubscription[]> = new Map();

  constructor(config: RealtimeConfig) {
    this.logger = config.logger;
    this.auth = config.auth;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }

  /**
   * Subscribe to table changes
   */
  public async subscribeToTable<T = any>(
    table: string,
    callback: (event: RealtimeEvent<T>) => void,
    options?: {
      schema?: string;
      filter?: string;
      event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
    }
  ): Promise<() => Promise<void>> {
    const channelId = `table:${options?.schema || 'public'}:${table}`;
    this.logger.info('[Realtime] Subscribing to table:', channelId);

    try {
      // Get or create channel
      let realtimeChannel = this.channels.get(channelId);

      if (!realtimeChannel) {
        const channel = this.supabase.channel(channelId);

        // Subscribe to table changes
        channel.on(
          'postgres_changes',
          {
            event: options?.event || '*',
            schema: options?.schema || 'public',
            table: table,
            filter: options?.filter,
          },
          (payload) => {
            this.logger.info('[Realtime] Table change event:', payload);

            const event: RealtimeEvent<T> = {
              type: payload.eventType as any,
              table: payload.table,
              schema: payload.schema,
              oldRecord: payload.old as T,
              newRecord: payload.new as T,
              timestamp: new Date(),
            };

            // Notify all subscribers
            this.notifyTableSubscribers(channelId, event);
          }
        );

        // Subscribe to the channel
        await channel.subscribe();

        realtimeChannel = {
          id: channelId,
          name: table,
          topic: channelId,
          subscription: channel,
        };

        this.channels.set(channelId, realtimeChannel);
      }

      // Add subscriber
      const subscription: RealtimeSubscription<T> = {
        channelId,
        callback,
        unsubscribe: async () => {
          await this.unsubscribeFromTable(channelId, subscription);
        },
      };

      const existingSubs = this.subscriptions.get(channelId) || [];
      existingSubs.push(subscription);
      this.subscriptions.set(channelId, existingSubs);

      this.logger.info('[Realtime] Subscribed to table successfully');

      return subscription.unsubscribe;
    } catch (error) {
      this.logger.error('[Realtime] Error subscribing to table', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from table
   */
  private async unsubscribeFromTable(
    channelId: string,
    subscription: RealtimeSubscription
  ): Promise<void> {
    this.logger.info('[Realtime] Unsubscribing from table:', channelId);

    const subs = this.subscriptions.get(channelId) || [];
    const index = subs.indexOf(subscription);
    if (index > -1) {
      subs.splice(index, 1);
    }

    // If no more subscribers, remove the channel
    if (subs.length === 0) {
      const channel = this.channels.get(channelId);
      if (channel) {
        await this.supabase.removeChannel(channel.subscription);
        this.channels.delete(channelId);
      }
      this.subscriptions.delete(channelId);
    } else {
      this.subscriptions.set(channelId, subs);
    }
  }

  /**
   * Notify table subscribers
   */
  private notifyTableSubscribers<T>(channelId: string, event: RealtimeEvent<T>): void {
    const subs = this.subscriptions.get(channelId) || [];
    subs.forEach((sub) => {
      try {
        sub.callback(event);
      } catch (error) {
        this.logger.error('[Realtime] Error in subscription callback', error);
      }
    });
  }

  /**
   * Subscribe to a broadcast channel
   */
  public async subscribeToBroadcast(
    channelName: string,
    eventName: string,
    callback: (payload: any) => void
  ): Promise<() => Promise<void>> {
    const channelId = `broadcast:${channelName}`;
    this.logger.info('[Realtime] Subscribing to broadcast:', channelId);

    try {
      let realtimeChannel = this.channels.get(channelId);

      if (!realtimeChannel) {
        const channel = this.supabase.channel(channelName);

        // Subscribe to broadcast events
        channel.on('broadcast', { event: eventName }, (payload) => {
          this.logger.info('[Realtime] Broadcast event:', payload);

          const event: RealtimeEvent = {
            type: 'BROADCAST',
            payload: payload.payload,
            timestamp: new Date(),
          };

          this.notifyBroadcastSubscribers(channelId, event);
        });

        await channel.subscribe();

        realtimeChannel = {
          id: channelId,
          name: channelName,
          topic: channelId,
          subscription: channel,
        };

        this.channels.set(channelId, realtimeChannel);
      }

      const subscription: RealtimeSubscription = {
        channelId,
        callback,
        unsubscribe: async () => {
          await this.unsubscribeFromBroadcast(channelId, subscription);
        },
      };

      const existingSubs = this.subscriptions.get(channelId) || [];
      existingSubs.push(subscription);
      this.subscriptions.set(channelId, existingSubs);

      return subscription.unsubscribe;
    } catch (error) {
      this.logger.error('[Realtime] Error subscribing to broadcast', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from broadcast
   */
  private async unsubscribeFromBroadcast(
    channelId: string,
    subscription: RealtimeSubscription
  ): Promise<void> {
    this.logger.info('[Realtime] Unsubscribing from broadcast:', channelId);

    const subs = this.subscriptions.get(channelId) || [];
    const index = subs.indexOf(subscription);
    if (index > -1) {
      subs.splice(index, 1);
    }

    if (subs.length === 0) {
      const channel = this.channels.get(channelId);
      if (channel) {
        await this.supabase.removeChannel(channel.subscription);
        this.channels.delete(channelId);
      }
      this.subscriptions.delete(channelId);
    } else {
      this.subscriptions.set(channelId, subs);
    }
  }

  /**
   * Notify broadcast subscribers
   */
  private notifyBroadcastSubscribers(channelId: string, event: RealtimeEvent): void {
    const subs = this.subscriptions.get(channelId) || [];
    subs.forEach((sub) => {
      try {
        sub.callback(event);
      } catch (error) {
        this.logger.error('[Realtime] Error in broadcast callback', error);
      }
    });
  }

  /**
   * Broadcast a message to a channel
   */
  public async broadcast(channelName: string, eventName: string, payload: any): Promise<void> {
    this.logger.info('[Realtime] Broadcasting to channel:', channelName);

    try {
      const channelId = `broadcast:${channelName}`;
      let channel = this.channels.get(channelId);

      if (!channel) {
        // Create a temporary channel for broadcasting
        const tempChannel = this.supabase.channel(channelName);
        await tempChannel.subscribe();

        await tempChannel.send({
          type: 'broadcast',
          event: eventName,
          payload,
        });

        await this.supabase.removeChannel(tempChannel);
      } else {
        await channel.subscription.send({
          type: 'broadcast',
          event: eventName,
          payload,
        });
      }

      this.logger.info('[Realtime] Broadcast sent successfully');
    } catch (error) {
      this.logger.error('[Realtime] Error broadcasting', error);
      throw error;
    }
  }

  /**
   * Subscribe to presence (user online/offline status)
   */
  public async subscribeToPresence(
    channelName: string,
    onJoin: (user: any) => void,
    onLeave: (user: any) => void
  ): Promise<() => Promise<void>> {
    const channelId = `presence:${channelName}`;
    this.logger.info('[Realtime] Subscribing to presence:', channelId);

    try {
      const channel = this.supabase.channel(channelName);

      // Track presence
      const user = await this.auth.getCurrentUser();
      if (user) {
        channel.on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          this.logger.info('[Realtime] Presence sync:', state);
        });

        channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
          this.logger.info('[Realtime] User joined:', key, newPresences);
          newPresences.forEach(onJoin);
        });

        channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          this.logger.info('[Realtime] User left:', key, leftPresences);
          leftPresences.forEach(onLeave);
        });

        await channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
          }
        });

        const realtimeChannel: RealtimeChannel = {
          id: channelId,
          name: channelName,
          topic: channelId,
          subscription: channel,
        };

        this.channels.set(channelId, realtimeChannel);

        return async () => {
          await channel.untrack();
          await this.supabase.removeChannel(channel);
          this.channels.delete(channelId);
        };
      }

      throw new Error('User not authenticated');
    } catch (error) {
      this.logger.error('[Realtime] Error subscribing to presence', error);
      throw error;
    }
  }

  /**
   * Get all active channels
   */
  public getActiveChannels(): RealtimeChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Get channel by ID
   */
  public getChannel(channelId: string): RealtimeChannel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Unsubscribe from all channels
   */
  public async unsubscribeAll(): Promise<void> {
    this.logger.info('[Realtime] Unsubscribing from all channels');

    const promises: Promise<void>[] = [];

    this.channels.forEach((channel) => {
      promises.push(this.supabase.removeChannel(channel.subscription));
    });

    await Promise.all(promises);

    this.channels.clear();
    this.subscriptions.clear();

    this.logger.info('[Realtime] All channels unsubscribed');
  }

  /**
   * Clean up all subscriptions
   */
  public cleanup(): void {
    this.logger.info('[Realtime] Cleaning up');
    this.unsubscribeAll().catch((error) => {
      this.logger.error('[Realtime] Error during cleanup', error);
    });
  }
}

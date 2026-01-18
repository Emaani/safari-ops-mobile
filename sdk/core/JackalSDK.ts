/**
 * Jackal Adventures Mobile SDK - Core
 *
 * Main SDK class that initializes and manages all services.
 */

import { AuthService } from '../auth/AuthService';
import { PushNotificationService } from '../notifications/PushNotificationService';
import { MessagingService } from '../messaging/MessagingService';
import { RealtimeService } from '../realtime/RealtimeService';
import { OfflineSyncService } from '../offline/OfflineSyncService';
import { APIService } from '../api/APIService';
import { StorageService } from '../storage/StorageService';
import { Logger, LogLevel } from '../utils/Logger';
import { NetworkMonitor } from '../utils/NetworkMonitor';

export interface JackalSDKConfig {
  /**
   * Supabase Configuration
   */
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };

  /**
   * EAS Project Configuration
   */
  eas?: {
    projectId: string;
  };

  /**
   * API Configuration
   */
  api?: {
    baseUrl?: string;
    timeout?: number;
    retryAttempts?: number;
  };

  /**
   * Offline Sync Configuration
   */
  offline?: {
    enabled?: boolean;
    syncInterval?: number;
    maxQueueSize?: number;
  };

  /**
   * Logging Configuration
   */
  logging?: {
    level?: LogLevel;
    enabled?: boolean;
  };

  /**
   * Custom Configuration
   */
  custom?: Record<string, any>;
}

export class JackalSDK {
  private static instance: JackalSDK | null = null;
  private _isInitialized = false;

  // Services
  public readonly auth: AuthService;
  public readonly pushNotifications: PushNotificationService;
  public readonly messaging: MessagingService;
  public readonly realtime: RealtimeService;
  public readonly offlineSync: OfflineSyncService;
  public readonly api: APIService;
  public readonly storage: StorageService;
  public readonly logger: Logger;
  public readonly network: NetworkMonitor;

  // Configuration
  private config: JackalSDKConfig;

  private constructor(config: JackalSDKConfig) {
    this.config = config;

    // Initialize logger first
    this.logger = new Logger({
      level: config.logging?.level || 'info',
      enabled: config.logging?.enabled !== false,
    });

    this.logger.info('Initializing Jackal Adventures SDK');

    // Initialize storage
    this.storage = new StorageService();

    // Initialize network monitor
    this.network = new NetworkMonitor();

    // Initialize core services
    this.auth = new AuthService({
      supabaseUrl: config.supabase.url,
      supabaseKey: config.supabase.anonKey,
      logger: this.logger,
      storage: this.storage,
    });

    this.api = new APIService({
      baseUrl: config.api?.baseUrl,
      timeout: config.api?.timeout,
      retryAttempts: config.api?.retryAttempts,
      logger: this.logger,
      auth: this.auth,
    });

    this.pushNotifications = new PushNotificationService({
      easProjectId: config.eas?.projectId,
      logger: this.logger,
      auth: this.auth,
      api: this.api,
    });

    this.messaging = new MessagingService({
      logger: this.logger,
      auth: this.auth,
      api: this.api,
      storage: this.storage,
    });

    this.realtime = new RealtimeService({
      supabaseUrl: config.supabase.url,
      supabaseKey: config.supabase.anonKey,
      logger: this.logger,
      auth: this.auth,
    });

    this.offlineSync = new OfflineSyncService({
      enabled: config.offline?.enabled !== false,
      syncInterval: config.offline?.syncInterval,
      maxQueueSize: config.offline?.maxQueueSize,
      logger: this.logger,
      storage: this.storage,
      network: this.network,
      api: this.api,
    });

    this.logger.info('Jackal Adventures SDK initialized successfully');
  }

  /**
   * Initialize the SDK with configuration
   */
  public static initialize(config: JackalSDKConfig): JackalSDK {
    if (JackalSDK.instance) {
      throw new Error('JackalSDK is already initialized. Use JackalSDK.getInstance() instead.');
    }

    JackalSDK.instance = new JackalSDK(config);
    JackalSDK.instance._isInitialized = true;
    return JackalSDK.instance;
  }

  /**
   * Get the SDK instance
   */
  public static getInstance(): JackalSDK {
    if (!JackalSDK.instance) {
      throw new Error('JackalSDK is not initialized. Call JackalSDK.initialize() first.');
    }
    return JackalSDK.instance;
  }

  /**
   * Check if SDK is initialized
   */
  public static isInitialized(): boolean {
    return JackalSDK.instance?._isInitialized || false;
  }

  /**
   * Reset the SDK instance (for testing)
   */
  public static reset(): void {
    if (JackalSDK.instance) {
      JackalSDK.instance.destroy();
      JackalSDK.instance = null;
    }
  }

  /**
   * Get SDK configuration
   */
  public getConfig(): JackalSDKConfig {
    return { ...this.config };
  }

  /**
   * Update SDK configuration
   */
  public updateConfig(updates: Partial<JackalSDKConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.info('SDK configuration updated', updates);
  }

  /**
   * Check if user is authenticated
   */
  public async isAuthenticated(): Promise<boolean> {
    return this.auth.isAuthenticated();
  }

  /**
   * Get current user
   */
  public async getCurrentUser() {
    return this.auth.getCurrentUser();
  }

  /**
   * Start all background services
   */
  public async start(): Promise<void> {
    this.logger.info('Starting SDK services');

    try {
      // Start network monitoring
      await this.network.start();

      // Start offline sync if enabled
      if (this.config.offline?.enabled !== false) {
        await this.offlineSync.start();
      }

      // Initialize push notifications if user is authenticated
      const isAuth = await this.isAuthenticated();
      if (isAuth) {
        await this.pushNotifications.initialize();
      }

      this.logger.info('SDK services started successfully');
    } catch (error) {
      this.logger.error('Error starting SDK services', error);
      throw error;
    }
  }

  /**
   * Stop all background services
   */
  public async stop(): Promise<void> {
    this.logger.info('Stopping SDK services');

    try {
      await this.offlineSync.stop();
      await this.network.stop();
      this.pushNotifications.cleanup();
      this.realtime.cleanup();

      this.logger.info('SDK services stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping SDK services', error);
    }
  }

  /**
   * Clean up and destroy the SDK instance
   */
  public destroy(): void {
    this.logger.info('Destroying SDK instance');
    this.stop().catch((error) => {
      this.logger.error('Error during SDK cleanup', error);
    });
  }

  /**
   * Get SDK version
   */
  public getVersion(): string {
    return '1.0.0';
  }

  /**
   * Get SDK health status
   */
  public async getHealthStatus() {
    return {
      initialized: this._isInitialized,
      authenticated: await this.isAuthenticated(),
      networkStatus: await this.network.getStatus(),
      offlineSyncStatus: this.offlineSync.getStatus(),
      version: this.getVersion(),
    };
  }
}

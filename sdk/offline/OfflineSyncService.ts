/**
 * Offline Sync Service
 *
 * Handles offline data synchronization, queue management, and conflict resolution
 */

import type { Logger } from '../utils/Logger';
import type { StorageService } from '../storage/StorageService';
import type { NetworkMonitor } from '../utils/NetworkMonitor';
import type { APIService } from '../api/APIService';

export interface SyncConfig {
  enabled?: boolean;
  syncInterval?: number; // milliseconds
  maxQueueSize?: number;
  logger: Logger;
  storage: StorageService;
  network: NetworkMonitor;
  api: APIService;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  pendingOperations: number;
  failedOperations: number;
  successfulOperations: number;
}

export interface SyncOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  resource: string; // e.g., 'bookings', 'fleet', 'transactions'
  data: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

export interface SyncQueue {
  operations: SyncOperation[];
  addedAt: Date;
  updatedAt: Date;
}

const STORAGE_KEY_QUEUE = '@jackal_sync_queue';
const STORAGE_KEY_STATUS = '@jackal_sync_status';
const DEFAULT_SYNC_INTERVAL = 30000; // 30 seconds
const DEFAULT_MAX_QUEUE_SIZE = 1000;
const DEFAULT_MAX_RETRIES = 3;

export class OfflineSyncService {
  private logger: Logger;
  private storage: StorageService;
  private network: NetworkMonitor;
  private api: APIService;

  private enabled: boolean;
  private syncInterval: number;
  private maxQueueSize: number;
  private syncTimer: NodeJS.Timeout | null = null;

  private queue: SyncOperation[] = [];
  private status: SyncStatus = {
    isOnline: true,
    isSyncing: false,
    lastSyncTime: null,
    pendingOperations: 0,
    failedOperations: 0,
    successfulOperations: 0,
  };

  constructor(config: SyncConfig) {
    this.logger = config.logger;
    this.storage = config.storage;
    this.network = config.network;
    this.api = config.api;

    this.enabled = config.enabled !== false;
    this.syncInterval = config.syncInterval || DEFAULT_SYNC_INTERVAL;
    this.maxQueueSize = config.maxQueueSize || DEFAULT_MAX_QUEUE_SIZE;
  }

  /**
   * Start the offline sync service
   */
  public async start(): Promise<void> {
    if (!this.enabled) {
      this.logger.info('[OfflineSync] Service disabled');
      return;
    }

    this.logger.info('[OfflineSync] Starting service');

    try {
      // Load queue from storage
      await this.loadQueue();

      // Load status from storage
      await this.loadStatus();

      // Listen to network changes
      this.network.addListener((networkStatus) => {
        const wasOffline = !this.status.isOnline;
        this.status.isOnline = networkStatus.isConnected;

        // If we just came online, trigger sync
        if (wasOffline && networkStatus.isConnected) {
          this.logger.info('[OfflineSync] Network restored, triggering sync');
          this.syncNow();
        }
      });

      // Start periodic sync
      this.startPeriodicSync();

      // Perform initial sync if online
      if (this.status.isOnline) {
        await this.syncNow();
      }

      this.logger.info('[OfflineSync] Service started successfully');
    } catch (error) {
      this.logger.error('[OfflineSync] Error starting service', error);
      throw error;
    }
  }

  /**
   * Stop the offline sync service
   */
  public async stop(): Promise<void> {
    this.logger.info('[OfflineSync] Stopping service');

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    // Save queue and status before stopping
    await this.saveQueue();
    await this.saveStatus();

    this.logger.info('[OfflineSync] Service stopped');
  }

  /**
   * Add operation to sync queue
   */
  public async addOperation(
    type: SyncOperation['type'],
    resource: string,
    data: any
  ): Promise<void> {
    this.logger.info('[OfflineSync] Adding operation to queue:', { type, resource });

    try {
      // Check queue size limit
      if (this.queue.length >= this.maxQueueSize) {
        this.logger.warn('[OfflineSync] Queue size limit reached, removing oldest operation');
        this.queue.shift();
      }

      const operation: SyncOperation = {
        id: this.generateOperationId(),
        type,
        resource,
        data,
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: DEFAULT_MAX_RETRIES,
        status: 'pending',
      };

      this.queue.push(operation);
      this.status.pendingOperations = this.queue.filter((op) => op.status === 'pending').length;

      // Save queue
      await this.saveQueue();

      // If online, try to sync immediately
      if (this.status.isOnline && !this.status.isSyncing) {
        await this.syncNow();
      }
    } catch (error) {
      this.logger.error('[OfflineSync] Error adding operation', error);
      throw error;
    }
  }

  /**
   * Sync all pending operations
   */
  public async syncNow(): Promise<void> {
    if (!this.enabled || !this.status.isOnline) {
      this.logger.warn('[OfflineSync] Cannot sync: service disabled or offline');
      return;
    }

    if (this.status.isSyncing) {
      this.logger.warn('[OfflineSync] Sync already in progress');
      return;
    }

    if (this.queue.length === 0) {
      this.logger.info('[OfflineSync] No operations to sync');
      return;
    }

    this.logger.info('[OfflineSync] Starting sync of', this.queue.length, 'operations');
    this.status.isSyncing = true;

    try {
      const pendingOps = this.queue.filter(
        (op) => op.status === 'pending' || op.status === 'failed'
      );

      for (const operation of pendingOps) {
        try {
          await this.syncOperation(operation);
        } catch (error) {
          this.logger.error('[OfflineSync] Error syncing operation:', operation.id, error);
          operation.status = 'failed';
          operation.error = (error as Error).message;
          operation.retryCount++;

          if (operation.retryCount >= operation.maxRetries) {
            this.logger.error('[OfflineSync] Max retries reached for operation:', operation.id);
            this.status.failedOperations++;
          }
        }
      }

      // Remove completed operations
      this.queue = this.queue.filter((op) => op.status !== 'completed');

      // Update status
      this.status.lastSyncTime = new Date();
      this.status.pendingOperations = this.queue.filter((op) => op.status === 'pending').length;

      // Save queue and status
      await this.saveQueue();
      await this.saveStatus();

      this.logger.info('[OfflineSync] Sync completed');
    } catch (error) {
      this.logger.error('[OfflineSync] Sync failed', error);
    } finally {
      this.status.isSyncing = false;
    }
  }

  /**
   * Sync a single operation
   */
  private async syncOperation(operation: SyncOperation): Promise<void> {
    this.logger.info('[OfflineSync] Syncing operation:', operation.id);

    operation.status = 'syncing';

    try {
      switch (operation.type) {
        case 'CREATE':
          await this.api.post(`/${operation.resource}`, operation.data);
          break;
        case 'UPDATE':
          await this.api.patch(`/${operation.resource}/${operation.data.id}`, operation.data);
          break;
        case 'DELETE':
          await this.api.delete(`/${operation.resource}/${operation.data.id}`);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      operation.status = 'completed';
      this.status.successfulOperations++;

      this.logger.info('[OfflineSync] Operation synced successfully:', operation.id);
    } catch (error) {
      operation.status = 'failed';
      operation.error = (error as Error).message;
      throw error;
    }
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      if (this.status.isOnline && !this.status.isSyncing && this.queue.length > 0) {
        this.logger.info('[OfflineSync] Periodic sync triggered');
        this.syncNow().catch((error) => {
          this.logger.error('[OfflineSync] Periodic sync failed', error);
        });
      }
    }, this.syncInterval);

    this.logger.info('[OfflineSync] Periodic sync started with interval:', this.syncInterval);
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load queue from storage
   */
  private async loadQueue(): Promise<void> {
    try {
      const stored = await this.storage.getItem(STORAGE_KEY_QUEUE);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.queue = parsed.operations.map((op: any) => ({
          ...op,
          timestamp: new Date(op.timestamp),
        }));
        this.logger.info('[OfflineSync] Queue loaded:', this.queue.length, 'operations');
      }
    } catch (error) {
      this.logger.error('[OfflineSync] Error loading queue', error);
    }
  }

  /**
   * Save queue to storage
   */
  private async saveQueue(): Promise<void> {
    try {
      const queueData: SyncQueue = {
        operations: this.queue,
        addedAt: new Date(),
        updatedAt: new Date(),
      };
      await this.storage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queueData));
    } catch (error) {
      this.logger.error('[OfflineSync] Error saving queue', error);
    }
  }

  /**
   * Load status from storage
   */
  private async loadStatus(): Promise<void> {
    try {
      const stored = await this.storage.getItem(STORAGE_KEY_STATUS);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.status = {
          ...this.status,
          ...parsed,
          lastSyncTime: parsed.lastSyncTime ? new Date(parsed.lastSyncTime) : null,
        };
        this.logger.info('[OfflineSync] Status loaded');
      }
    } catch (error) {
      this.logger.error('[OfflineSync] Error loading status', error);
    }
  }

  /**
   * Save status to storage
   */
  private async saveStatus(): Promise<void> {
    try {
      await this.storage.setItem(STORAGE_KEY_STATUS, JSON.stringify(this.status));
    } catch (error) {
      this.logger.error('[OfflineSync] Error saving status', error);
    }
  }

  /**
   * Get sync status
   */
  public getStatus(): SyncStatus {
    return { ...this.status };
  }

  /**
   * Get pending operations
   */
  public getPendingOperations(): SyncOperation[] {
    return this.queue.filter((op) => op.status === 'pending');
  }

  /**
   * Get failed operations
   */
  public getFailedOperations(): SyncOperation[] {
    return this.queue.filter((op) => op.status === 'failed');
  }

  /**
   * Clear queue
   */
  public async clearQueue(): Promise<void> {
    this.logger.info('[OfflineSync] Clearing queue');
    this.queue = [];
    this.status.pendingOperations = 0;
    await this.saveQueue();
    await this.saveStatus();
  }

  /**
   * Retry failed operations
   */
  public async retryFailedOperations(): Promise<void> {
    this.logger.info('[OfflineSync] Retrying failed operations');

    const failedOps = this.getFailedOperations();
    failedOps.forEach((op) => {
      op.status = 'pending';
      op.retryCount = 0;
      op.error = undefined;
    });

    await this.saveQueue();
    await this.syncNow();
  }
}

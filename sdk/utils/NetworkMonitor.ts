/**
 * Network Monitor
 *
 * Monitors network connectivity and type
 */

import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  type: NetworkType;
  isInternetReachable: boolean | null;
}

export type NetworkType = 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';

type NetworkListener = (status: NetworkStatus) => void;

export class NetworkMonitor {
  private listeners: NetworkListener[] = [];
  private unsubscribe: (() => void) | null = null;
  private currentStatus: NetworkStatus = {
    isConnected: true,
    type: 'unknown',
    isInternetReachable: null,
  };

  /**
   * Start monitoring network status
   */
  public async start(): Promise<void> {
    // Get initial status
    const state = await NetInfo.fetch();
    this.currentStatus = this.mapNetInfoState(state);

    // Subscribe to changes
    this.unsubscribe = NetInfo.addEventListener((state) => {
      const status = this.mapNetInfoState(state);
      this.currentStatus = status;
      this.notifyListeners(status);
    });
  }

  /**
   * Stop monitoring network status
   */
  public async stop(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * Get current network status
   */
  public async getStatus(): Promise<NetworkStatus> {
    return this.currentStatus;
  }

  /**
   * Check if connected
   */
  public async isConnected(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected || false;
  }

  /**
   * Add network status listener
   */
  public addListener(listener: NetworkListener): () => void {
    this.listeners.push(listener);

    // Immediately call with current status
    listener(this.currentStatus);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Map NetInfo state to NetworkStatus
   */
  private mapNetInfoState(state: NetInfoState): NetworkStatus {
    return {
      isConnected: state.isConnected || false,
      type: this.mapNetworkType(state.type),
      isInternetReachable: state.isInternetReachable,
    };
  }

  /**
   * Map NetInfo type to NetworkType
   */
  private mapNetworkType(type: NetInfoStateType): NetworkType {
    switch (type) {
      case 'wifi':
        return 'wifi';
      case 'cellular':
        return 'cellular';
      case 'ethernet':
        return 'ethernet';
      case 'none':
        return 'none';
      default:
        return 'unknown';
    }
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(status: NetworkStatus): void {
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (error) {
        console.error('[NetworkMonitor] Error in listener:', error);
      }
    });
  }
}

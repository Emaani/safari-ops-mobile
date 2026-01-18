/**
 * Device Info
 *
 * Provides device information and capabilities
 */

import * as Device from 'expo-device';
import { Platform, Dimensions } from 'react-native';
import Constants from 'expo-constants';

export interface DeviceDetails {
  deviceId: string;
  deviceName: string;
  brand: string;
  manufacturer: string;
  modelName: string;
  modelId: string;
  platform: Platform;
  osVersion: string;
  appVersion: string;
  buildNumber: string;
  isDevice: boolean;
  screenWidth: number;
  screenHeight: number;
}

export type Platform = 'ios' | 'android' | 'web';

export class DeviceInfo {
  private static instance: DeviceInfo | null = null;
  private deviceDetails: DeviceDetails | null = null;

  private constructor() {}

  /**
   * Get DeviceInfo instance
   */
  public static getInstance(): DeviceInfo {
    if (!DeviceInfo.instance) {
      DeviceInfo.instance = new DeviceInfo();
    }
    return DeviceInfo.instance;
  }

  /**
   * Get device details
   */
  public async getDeviceDetails(): Promise<DeviceDetails> {
    if (this.deviceDetails) {
      return this.deviceDetails;
    }

    const { width, height } = Dimensions.get('window');

    this.deviceDetails = {
      deviceId: this.getDeviceId(),
      deviceName: Device.deviceName || 'Unknown',
      brand: Device.brand || 'Unknown',
      manufacturer: Device.manufacturer || 'Unknown',
      modelName: Device.modelName || 'Unknown',
      modelId: Device.modelId || 'Unknown',
      platform: this.getPlatform(),
      osVersion: Device.osVersion || 'Unknown',
      appVersion: this.getAppVersion(),
      buildNumber: this.getBuildNumber(),
      isDevice: Device.isDevice,
      screenWidth: width,
      screenHeight: height,
    };

    return this.deviceDetails;
  }

  /**
   * Get device ID
   */
  public getDeviceId(): string {
    // Create a unique device ID from available information
    const platform = Platform.OS;
    const model = Device.modelName || 'unknown';
    const os = Device.osVersion || 'unknown';

    return `${platform}-${model}-${os}`.replace(/\s/g, '-').toLowerCase();
  }

  /**
   * Get platform
   */
  public getPlatform(): Platform {
    return Platform.OS as Platform;
  }

  /**
   * Check if iOS
   */
  public isIOS(): boolean {
    return Platform.OS === 'ios';
  }

  /**
   * Check if Android
   */
  public isAndroid(): boolean {
    return Platform.OS === 'android';
  }

  /**
   * Check if Web
   */
  public isWeb(): boolean {
    return Platform.OS === 'web';
  }

  /**
   * Check if physical device
   */
  public isPhysicalDevice(): boolean {
    return Device.isDevice;
  }

  /**
   * Check if tablet
   */
  public isTablet(): boolean {
    const { width, height } = Dimensions.get('window');
    const aspectRatio = Math.max(width, height) / Math.min(width, height);

    // Simple heuristic: tablets usually have aspect ratio < 1.6
    return aspectRatio < 1.6 && Math.min(width, height) >= 600;
  }

  /**
   * Get app version
   */
  public getAppVersion(): string {
    return Constants.expoConfig?.version || '1.0.0';
  }

  /**
   * Get build number
   */
  public getBuildNumber(): string {
    if (Platform.OS === 'ios') {
      return Constants.expoConfig?.ios?.buildNumber || '1';
    } else if (Platform.OS === 'android') {
      return Constants.expoConfig?.android?.versionCode?.toString() || '1';
    }
    return '1';
  }

  /**
   * Get screen dimensions
   */
  public getScreenDimensions(): { width: number; height: number } {
    return Dimensions.get('window');
  }

  /**
   * Get OS version
   */
  public getOSVersion(): string {
    return Device.osVersion || 'Unknown';
  }

  /**
   * Get device name
   */
  public getDeviceName(): string {
    return Device.deviceName || 'Unknown Device';
  }

  /**
   * Get brand
   */
  public getBrand(): string {
    return Device.brand || 'Unknown';
  }

  /**
   * Get manufacturer
   */
  public getManufacturer(): string {
    return Device.manufacturer || 'Unknown';
  }

  /**
   * Get model name
   */
  public getModelName(): string {
    return Device.modelName || 'Unknown';
  }

  /**
   * Get user agent
   */
  public async getUserAgent(): Promise<string> {
    const details = await this.getDeviceDetails();
    return `JackalAdventures/${details.appVersion} (${details.platform}; ${details.osVersion}; ${details.modelName})`;
  }

  /**
   * Clear cached device details
   */
  public clearCache(): void {
    this.deviceDetails = null;
  }
}

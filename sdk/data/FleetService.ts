/**
 * Fleet Service
 */

import type { APIService } from '../api/APIService';
import type { Logger } from '../utils/Logger';

export interface Vehicle {
  id: string;
  registration_number: string;
  make: string;
  model: string;
  status: 'available' | 'in_use' | 'maintenance' | 'retired';
  capacity: number;
}

export interface FleetStatus {
  total: number;
  available: number;
  in_use: number;
  maintenance: number;
}

export class FleetService {
  private api: APIService;
  private logger: Logger;

  constructor(api: APIService, logger: Logger) {
    this.api = api;
    this.logger = logger;
  }

  public async getVehicles(): Promise<Vehicle[]> {
    const response = await this.api.get<Vehicle[]>('/fleet');
    return response.data;
  }

  public async getVehicle(id: string): Promise<Vehicle> {
    const response = await this.api.get<Vehicle>(`/fleet/${id}`);
    return response.data;
  }

  public async getFleetStatus(): Promise<FleetStatus> {
    const response = await this.api.get<FleetStatus>('/fleet/status');
    return response.data;
  }

  public async updateVehicle(id: string, data: Partial<Vehicle>): Promise<Vehicle> {
    const response = await this.api.patch<Vehicle>(`/fleet/${id}`, data);
    return response.data;
  }
}

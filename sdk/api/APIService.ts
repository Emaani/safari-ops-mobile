/**
 * API Service
 *
 * HTTP client for making API requests with authentication and error handling
 */

import type { Logger } from '../utils/Logger';
import type { AuthService } from '../auth/AuthService';

export interface APIConfig {
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  logger: Logger;
  auth: AuthService;
}

export interface APIRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
}

export interface APIResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface APIError {
  code: string;
  message: string;
  status?: number;
  data?: any;
}

type RequestInterceptor = (config: APIRequest) => APIRequest | Promise<APIRequest>;
type ResponseInterceptor = (response: APIResponse) => APIResponse | Promise<APIResponse>;

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRY_ATTEMPTS = 3;

export class APIService {
  private logger: Logger;
  private auth: AuthService;
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(config: APIConfig) {
    this.logger = config.logger;
    this.auth = config.auth;
    this.baseUrl = config.baseUrl || '';
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.retryAttempts = config.retryAttempts || DEFAULT_RETRY_ATTEMPTS;
  }

  /**
   * Make a GET request
   */
  public async get<T = any>(url: string, params?: Record<string, string>): Promise<APIResponse<T>> {
    return this.request<T>({
      method: 'GET',
      url,
      params,
    });
  }

  /**
   * Make a POST request
   */
  public async post<T = any>(url: string, body?: any): Promise<APIResponse<T>> {
    return this.request<T>({
      method: 'POST',
      url,
      body,
    });
  }

  /**
   * Make a PUT request
   */
  public async put<T = any>(url: string, body?: any): Promise<APIResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      url,
      body,
    });
  }

  /**
   * Make a PATCH request
   */
  public async patch<T = any>(url: string, body?: any): Promise<APIResponse<T>> {
    return this.request<T>({
      method: 'PATCH',
      url,
      body,
    });
  }

  /**
   * Make a DELETE request
   */
  public async delete<T = any>(url: string): Promise<APIResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      url,
    });
  }

  /**
   * Make an API request
   */
  private async request<T = any>(config: APIRequest): Promise<APIResponse<T>> {
    this.logger.info('[API] Request:', config.method, config.url);

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < this.retryAttempts) {
      try {
        // Apply request interceptors
        let requestConfig = { ...config };
        for (const interceptor of this.requestInterceptors) {
          requestConfig = await interceptor(requestConfig);
        }

        // Add authentication
        requestConfig = await this.addAuthentication(requestConfig);

        // Build URL
        const fullUrl = this.buildUrl(requestConfig.url, requestConfig.params);

        // Set up fetch options
        const options: RequestInit = {
          method: requestConfig.method,
          headers: {
            'Content-Type': 'application/json',
            ...requestConfig.headers,
          },
          signal: AbortSignal.timeout(this.timeout),
        };

        // Add body for POST, PUT, PATCH
        if (requestConfig.body && ['POST', 'PUT', 'PATCH'].includes(requestConfig.method)) {
          options.body = JSON.stringify(requestConfig.body);
        }

        // Make request
        const response = await fetch(fullUrl, options);

        // Parse response
        let data: T;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = (await response.text()) as any;
        }

        // Check for errors
        if (!response.ok) {
          throw this.createAPIError(response.status, data);
        }

        // Build response
        let apiResponse: APIResponse<T> = {
          data,
          status: response.status,
          headers: this.extractHeaders(response.headers),
        };

        // Apply response interceptors
        for (const interceptor of this.responseInterceptors) {
          apiResponse = await interceptor(apiResponse);
        }

        this.logger.info('[API] Response:', response.status, config.url);
        return apiResponse;

      } catch (error: any) {
        lastError = error;
        attempt++;

        // Don't retry on certain errors
        if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
          throw error;
        }

        // Don't retry on client errors (4xx except 429)
        if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw error;
        }

        if (attempt < this.retryAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          this.logger.warn('[API] Request failed, retrying in', delay, 'ms');
          await this.sleep(delay);
        }
      }
    }

    this.logger.error('[API] Request failed after', attempt, 'attempts');
    throw lastError || new Error('Request failed');
  }

  /**
   * Add authentication to request
   */
  private async addAuthentication(config: APIRequest): Promise<APIRequest> {
    const token = await this.auth.getAccessToken();

    if (token) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`,
      };
    }

    return config;
  }

  /**
   * Build full URL with params
   */
  private buildUrl(url: string, params?: Record<string, string>): string {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

    if (params) {
      const searchParams = new URLSearchParams(params);
      return `${fullUrl}?${searchParams.toString()}`;
    }

    return fullUrl;
  }

  /**
   * Extract headers from response
   */
  private extractHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};

    headers.forEach((value, key) => {
      result[key] = value;
    });

    return result;
  }

  /**
   * Create API error
   */
  private createAPIError(status: number, data: any): APIError {
    let code = 'API_ERROR';
    let message = 'An API error occurred';

    if (status === 401) {
      code = 'UNAUTHORIZED';
      message = 'Authentication required';
    } else if (status === 403) {
      code = 'FORBIDDEN';
      message = 'Access denied';
    } else if (status === 404) {
      code = 'NOT_FOUND';
      message = 'Resource not found';
    } else if (status === 429) {
      code = 'RATE_LIMIT';
      message = 'Rate limit exceeded';
    } else if (status >= 500) {
      code = 'SERVER_ERROR';
      message = 'Server error occurred';
    }

    // Try to extract error message from response
    if (data && typeof data === 'object') {
      if (data.message) {
        message = data.message;
      } else if (data.error) {
        message = data.error;
      }
    }

    return {
      code,
      message,
      status,
      data,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Add request interceptor
   */
  public addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  public addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Set base URL
   */
  public setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  /**
   * Get base URL
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Set timeout
   */
  public setTimeout(timeout: number): void {
    this.timeout = timeout;
  }

  /**
   * Set retry attempts
   */
  public setRetryAttempts(attempts: number): void {
    this.retryAttempts = attempts;
  }
}

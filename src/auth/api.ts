/**
 * API utility for authenticated requests
 * Adds bearer token to all API calls
 */

import { AuthManager } from "./manager";

export class AuthAPI {
  constructor(private authManager: AuthManager) {}

  /**
   * Make authenticated API request
   */
  async request(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = this.authManager.getAccessToken();
    
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    // Add bearer token if authenticated
    if (token) {
      (headers as any)["Authorization"] = `Bearer ${token}`;
    }

    return fetch(url, {
      ...options,
      headers,
    });
  }

  /**
   * Make authenticated POST request with JSON body
   */
  async post<T>(url: string, body: any): Promise<T> {
    const response = await this.request(url, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      throw new Error(error.detail || `Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Make authenticated GET request
   */
  async get<T>(url: string): Promise<T> {
    const response = await this.request(url, {
      method: "GET",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      throw new Error(error.detail || `Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
  }
}

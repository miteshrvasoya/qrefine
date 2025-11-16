/**
 * Authentication API client for QRefine
 * Handles login/register API calls to backend
 */

import { AuthCredentials, AuthResponse } from "./types";

const API_BASE_URL = "http://127.0.0.1:8000";

export class AuthClient {
  /**
   * Register a new user
   */
  static async register(credentials: AuthCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          username: credentials.username || credentials.email.split("@")[0],
        }),
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.detail || `Register failed with status ${response.status}`);
      }

      return await response.json() as AuthResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      throw new Error(`Registration Error: ${message}`);
    }
  }

  /**
   * Login existing user
   */
  static async login(credentials: AuthCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as any;
        throw new Error(error.detail || `Login failed with status ${response.status}`);
      }

      return await response.json() as AuthResponse;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      throw new Error(`Login Error: ${message}`);
    }
  }

  /**
   * Validate token by making an authenticated API call
   */
  static async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/validate`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

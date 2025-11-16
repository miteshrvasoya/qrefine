/**
 * Authentication storage handler for QRefine
 * Uses VS Code's secretStorage for secure token storage
 */

import * as vscode from "vscode";
import { AuthState, AuthCredentials, AuthResponse, DEFAULT_AUTH_STATE } from "./types";

const AUTH_STORAGE_KEY = "qrefine_auth";

export class AuthStorage {
  constructor(private secretStorage: vscode.SecretStorage) {}

  /**
   * Save authentication state to secure storage
   */
  async saveAuth(auth: AuthResponse): Promise<void> {
    const authState: AuthState = {
      access_token: auth.access_token,
      user_id: auth.user_id,
      username: auth.username,
      isAuthenticated: true,
    };

    await this.secretStorage.store(AUTH_STORAGE_KEY, JSON.stringify(authState));
    console.log("✅ Auth saved to secure storage");
  }

  /**
   * Retrieve authentication state from secure storage
   */
  async getAuth(): Promise<AuthState> {
    const stored = await this.secretStorage.get(AUTH_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_AUTH_STATE;
    }

    try {
      return JSON.parse(stored);
    } catch (error) {
      console.error("Failed to parse stored auth:", error);
      return DEFAULT_AUTH_STATE;
    }
  }

  /**
   * Clear authentication state from secure storage
   */
  async clearAuth(): Promise<void> {
    await this.secretStorage.delete(AUTH_STORAGE_KEY);
    console.log("✅ Auth cleared from secure storage");
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const auth = await this.getAuth();
    return auth.isAuthenticated && !!auth.access_token;
  }

  /**
   * Get access token
   */
  async getAccessToken(): Promise<string | null> {
    const auth = await this.getAuth();
    return auth.access_token;
  }

  /**
   * Get user info
   */
  async getUserInfo(): Promise<{ user_id: number; username: string } | null> {
    const auth = await this.getAuth();
    if (auth.user_id && auth.username) {
      return { user_id: auth.user_id, username: auth.username };
    }
    return null;
  }
}

/**
 * Authentication Manager for QRefine
 * Coordinates auth flow, storage, and API calls
 */

import * as vscode from "vscode";
import { AuthStorage } from "./storage";
import { AuthWebview } from "./webview";
import { AuthState } from "./types";

export class AuthManager {
  private authStorage: AuthStorage;
  private authWebview: AuthWebview;
  private authState: AuthState;
  private statusBarItem: vscode.StatusBarItem;

  constructor(private extensionUri: vscode.Uri, secretStorage: vscode.SecretStorage) {
    this.authStorage = new AuthStorage(secretStorage);
    this.authWebview = new AuthWebview(extensionUri, this.authStorage);
    this.authState = {
      access_token: null,
      user_id: null,
      username: null,
      isAuthenticated: false,
    };

    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );

    this.authWebview.onSuccess(
      (token, userId, username) => {
        this.authState = {
          access_token: token,
          user_id: userId,
          username: username,
          isAuthenticated: true,
        };
        this.updateStatusBar();
      }
    );
  }

  /**
   * Initialize auth manager - restore session or show login
   */
  async initialize(): Promise<void> {
    const auth = await this.authStorage.getAuth();
    
    if (auth.isAuthenticated && auth.access_token) {
      this.authState = auth;
      this.updateStatusBar();
      console.log("✅ Restored authentication session");
    } else {
      this.showLoginPrompt();
    }
  }

  /**
   * Show login webview and prompt user
   */
  private showLoginPrompt(): void {
    vscode.window
      .showInformationMessage(
        "QRefine: Please login to use all features",
        "Login"
      )
      .then((selection) => {
        if (selection === "Login") {
          this.authWebview.show();
        }
      });
  }

  /**
   * Show login/signup webview
   */
  async showAuthWebview(): Promise<void> {
    await this.authWebview.show();
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await this.authStorage.clearAuth();
    this.authState = {
      access_token: null,
      user_id: null,
      username: null,
      isAuthenticated: false,
    };
    this.updateStatusBar();
    vscode.window.showInformationMessage("✅ Logged out successfully");
  }

  /**
   * Get current auth state
   */
  getAuthState(): AuthState {
    return this.authState;
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return this.authState.access_token;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated && !!this.authState.access_token;
  }

  /**
   * Get user info
   */
  getUserInfo(): { user_id: number; username: string } | null {
    if (this.authState.user_id && this.authState.username) {
      return {
        user_id: this.authState.user_id,
        username: this.authState.username,
      };
    }
    return null;
  }

  /**
   * Update status bar with auth state
   */
  private updateStatusBar(): void {
    if (this.isAuthenticated()) {
      this.statusBarItem.text = `$(account) ${this.authState.username}`;
      this.statusBarItem.tooltip = "QRefine: Click to logout";
      this.statusBarItem.command = "qrefine.logout";
    } else {
      this.statusBarItem.text = "$(sign-in) QRefine Login";
      this.statusBarItem.tooltip = "QRefine: Click to login";
      this.statusBarItem.command = "qrefine.login";
    }
    this.statusBarItem.show();
  }

  /**
   * Get status bar item for disposal
   */
  getStatusBarItem(): vscode.StatusBarItem {
    return this.statusBarItem;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}

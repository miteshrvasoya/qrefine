/**
 * Authentication Webview for QRefine
 * Provides embedded login/signup UI in VS Code
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { AuthStorage } from "./storage";
import { AuthClient } from "./client";

export class AuthWebview {
  private panel: vscode.WebviewPanel | null = null;
  private extensionUri: vscode.Uri;
  private authStorage: AuthStorage;
  private onAuthSuccess: ((token: string, userId: number, username: string) => void) | null = null;

  constructor(extensionUri: vscode.Uri, authStorage: AuthStorage) {
    this.extensionUri = extensionUri;
    this.authStorage = authStorage;
  }

  /**
   * Show login/signup webview
   */
  public show(): Promise<void> {
    return new Promise((resolve) => {
      if (this.panel) {
        this.panel.reveal(vscode.ViewColumn.One);
        resolve();
        return;
      }

      this.panel = vscode.window.createWebviewPanel(
        "qrefineAuth",
        "QRefine - Login",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      this.panel.webview.html = this.getHtml();

      this.panel.webview.onDidReceiveMessage(
        (message) => this.handleMessage(message, resolve),
        undefined
      );

      this.panel.onDidDispose(() => {
        this.panel = null;
      });

      resolve();
    });
  }

  /**
   * Register a callback for successful authentication
   */
  public onSuccess(
    callback: (token: string, userId: number, username: string) => void
  ): void {
    this.onAuthSuccess = callback;
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(
    message: any,
    resolve: () => void
  ): Promise<void> {
    try {
      if (message.type === "login") {
        await this.handleLogin(message.email, message.password);
      } else if (message.type === "signup") {
        await this.handleSignup(message.email, message.password, message.username);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.panel?.webview.postMessage({
        type: "error",
        message: errorMsg,
      });
    }
  }

  /**
   * Handle login request
   */
  private async handleLogin(email: string, password: string): Promise<void> {
    vscode.window.showInformationMessage("Logging in...");

    const response = await AuthClient.login({ email, password });
    await this.authStorage.saveAuth(response);

    vscode.window.showInformationMessage(`✅ Welcome back, ${response.username}!`);

    if (this.onAuthSuccess) {
      this.onAuthSuccess(response.access_token, response.user_id, response.username);
    }

    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
  }

  /**
   * Handle signup request
   */
  private async handleSignup(
    email: string,
    password: string,
    username: string
  ): Promise<void> {
    vscode.window.showInformationMessage("Creating account...");

    const response = await AuthClient.register({
      email,
      password,
      username,
    });
    await this.authStorage.saveAuth(response);

    vscode.window.showInformationMessage(`✅ Welcome to QRefine, ${response.username}!`);

    if (this.onAuthSuccess) {
      this.onAuthSuccess(response.access_token, response.user_id, response.username);
    }

    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
    }
  }

  /**
   * Generate HTML for webview
   */
  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QRefine - Authentication</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      max-width: 400px;
      width: 100%;
      padding: 40px;
    }

    .logo {
      text-align: center;
      margin-bottom: 30px;
    }

    .logo h1 {
      font-size: 28px;
      color: #667eea;
      margin-bottom: 8px;
    }

    .logo p {
      color: #666;
      font-size: 14px;
    }

    .form {
      display: none;
    }

    .form.active {
      display: block;
    }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      margin-bottom: 8px;
      color: #333;
      font-weight: 500;
      font-size: 14px;
    }

    input {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.2s;
    }

    input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    button {
      width: 100%;
      padding: 12px 16px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
      margin-top: 10px;
    }

    button:hover {
      background: #5568d3;
    }

    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .toggle-form {
      text-align: center;
      margin-top: 20px;
    }

    .toggle-form button {
      background: none;
      color: #667eea;
      padding: 0;
      text-decoration: underline;
      font-weight: normal;
    }

    .toggle-form button:hover {
      background: none;
    }

    .error {
      background: #fee;
      color: #c00;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 13px;
      display: none;
    }

    .error.show {
      display: block;
    }

    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 8px;
      vertical-align: middle;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>QRefine</h1>
      <p>SQL Analysis & Optimization</p>
    </div>

    <div class="error" id="errorMsg"></div>

    <!-- Login Form -->
    <form id="loginForm" class="form active">
      <h2 style="margin-bottom: 20px; color: #333; font-size: 20px;">Login</h2>
      <div class="form-group">
        <label for="loginEmail">Email</label>
        <input type="email" id="loginEmail" placeholder="your@email.com" required>
      </div>
      <div class="form-group">
        <label for="loginPassword">Password</label>
        <input type="password" id="loginPassword" placeholder="••••••••" required>
      </div>
      <button type="submit" id="loginBtn">Sign In</button>
      <div class="toggle-form">
        <p style="color: #666; font-size: 14px; margin-bottom: 8px;">No account yet?</p>
        <button type="button" id="toSignup">Create one</button>
      </div>
    </form>

    <!-- Signup Form -->
    <form id="signupForm" class="form">
      <h2 style="margin-bottom: 20px; color: #333; font-size: 20px;">Create Account</h2>
      <div class="form-group">
        <label for="signupUsername">Username</label>
        <input type="text" id="signupUsername" placeholder="john_doe" required>
      </div>
      <div class="form-group">
        <label for="signupEmail">Email</label>
        <input type="email" id="signupEmail" placeholder="your@email.com" required>
      </div>
      <div class="form-group">
        <label for="signupPassword">Password</label>
        <input type="password" id="signupPassword" placeholder="••••••••" required>
      </div>
      <button type="submit" id="signupBtn">Create Account</button>
      <div class="toggle-form">
        <p style="color: #666; font-size: 14px; margin-bottom: 8px;">Already have an account?</p>
        <button type="button" id="toLogin">Sign in</button>
      </div>
    </form>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const errorMsg = document.getElementById('errorMsg');
    const toSignup = document.getElementById('toSignup');
    const toLogin = document.getElementById('toLogin');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');

    toSignup.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.classList.remove('active');
      signupForm.classList.add('active');
      errorMsg.classList.remove('show');
    });

    toLogin.addEventListener('click', (e) => {
      e.preventDefault();
      signupForm.classList.remove('active');
      loginForm.classList.add('active');
      errorMsg.classList.remove('show');
    });

    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      
      if (!email || !password) {
        showError('Please fill in all fields');
        return;
      }

      loginBtn.disabled = true;
      loginBtn.innerHTML = '<span class="spinner"></span>Signing in...';

      vscode.postMessage({
        type: 'login',
        email,
        password
      });
    });

    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('signupUsername').value;
      const email = document.getElementById('signupEmail').value;
      const password = document.getElementById('signupPassword').value;
      
      if (!username || !email || !password) {
        showError('Please fill in all fields');
        return;
      }

      if (password.length < 6) {
        showError('Password must be at least 6 characters');
        return;
      }

      signupBtn.disabled = true;
      signupBtn.innerHTML = '<span class="spinner"></span>Creating account...';

      vscode.postMessage({
        type: 'signup',
        username,
        email,
        password
      });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'error') {
        loginBtn.disabled = false;
        loginBtn.innerHTML = 'Sign In';
        signupBtn.disabled = false;
        signupBtn.innerHTML = 'Create Account';
        showError(message.message);
      }
    });

    function showError(msg) {
      errorMsg.textContent = msg;
      errorMsg.classList.add('show');
    }
  </script>
</body>
</html>`;
  }
}

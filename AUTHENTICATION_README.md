# QRefine Authentication Implementation

## Overview

QRefine now includes a built-in authentication system that allows users to log in/sign up directly within VS Code. Authentication data is securely stored using VS Code's `secretStorage` API, and all API calls automatically include authentication headers.

## Architecture

### Components

```
┌─────────────────────────────────────────────────────┐
│                 VS Code Extension                   │
├─────────────────────────────────────────────────────┤
│  AuthManager (Coordinator)                          │
│  ├─ AuthStorage (Secure Storage)                    │
│  ├─ AuthWebview (Login UI)                          │
│  ├─ AuthClient (API Calls)                          │
│  └─ AuthAPI (HTTP Helper)                           │
└─────────────────────────────────────────────────────┘
         │                                │
         ↓                                ↓
   [secretStorage]              Backend Auth API
   VS Code API            (http://127.0.0.1:8000)
   (Secure)
```

### Core Files

| File | Purpose |
|------|---------|
| `src/auth/manager.ts` | Main coordinator, handles initialization and state |
| `src/auth/webview.ts` | Embedded login/signup UI with form handling |
| `src/auth/storage.ts` | Secure token storage using VS Code secretStorage |
| `src/auth/client.ts` | Direct API calls for login/register |
| `src/auth/api.ts` | HTTP helper that adds auth headers to requests |
| `src/auth/types.ts` | TypeScript interfaces for auth data |

## Authentication Flow

### Initial Extension Activation

```
Extension Activates
  ↓
AuthManager.initialize()
  ├─ Check secretStorage for existing token
  ├─ If token exists → Restore session
  │  └─ Update status bar (show username)
  └─ If no token → Show login prompt
     └─ User clicks "Login" → Show webview
```

### Login Flow

```
User clicks status bar login button
  ↓
AuthManager.showAuthWebview()
  ├─ Opens embedded webview with login form
  ├─ User enters email + password
  └─ Form submission → postMessage to extension
  ↓
AuthManager receives message
  ├─ Calls AuthClient.login()
  ├─ Backend validates credentials
  └─ Returns { access_token, user_id, username }
  ↓
AuthStorage.saveAuth()
  ├─ Stores token in secretStorage (encrypted by VS Code)
  └─ AuthManager updates authState
  ↓
Status bar updates → Shows username
Webview closes automatically
```

### Signup Flow

```
User clicks "Create one" in login form
  ↓
Shows signup form
  ├─ Email
  ├─ Password (validated: ≥6 chars)
  └─ Username
  ↓
Form submission → postMessage to extension
  ↓
AuthManager receives message
  ├─ Calls AuthClient.register()
  ├─ Backend creates account
  └─ Returns auth tokens
  ↓
Same as login flow from here
```

### Logout Flow

```
User clicks status bar (when logged in)
  ↓
Runs qrefine.logout command
  ↓
AuthManager.logout()
  ├─ Calls AuthStorage.clearAuth()
  ├─ Clears secretStorage
  └─ Resets authState
  ↓
Status bar updates → Shows "Login" button
```

## API Integration

### All API calls automatically include auth token:

```typescript
// Before (without auth):
const response = await fetch('http://localhost:8000/analysis', {
  method: 'POST',
  body: JSON.stringify({ query })
});

// After (with auth):
const authAPI = new AuthAPI(authManager);
const response = await authAPI.post('/analysis', { query });
// Automatically adds:
// Authorization: Bearer <access_token>
// user_id in request body
```

### Example: Authenticated Query Analysis

```typescript
// In queryPlanWebview.ts
private async fetchQueryPlan(query: string) {
  try {
    const response = await this.authAPI.request(
      'http://localhost:8000/analysis',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, explain_only: false })
      }
    );
    // Token is automatically added by authAPI
  } catch (error) {
    // Handle error
  }
}
```

## Backend Integration

### Expected API Endpoints

```
POST /auth/register
├─ Body: { email, password, username }
└─ Response: { access_token, token_type, user_id, active_status, username }

POST /auth/login
├─ Body: { email, password }
└─ Response: { access_token, token_type, user_id, active_status, username }

GET /auth/validate (Optional)
├─ Headers: Authorization: Bearer <token>
└─ Response: { valid: true/false }

POST /analysis (Any endpoint)
├─ Headers: Authorization: Bearer <token>
├─ Body: { query, user_id, ... }
└─ Response: { plan, visual, suggestions, ... }
```

### cURL Examples

**Register:**
```bash
curl -X POST http://127.0.0.1:8000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "password": "secure_password",
    "username": "john_doe"
  }'

# Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user_id": 1,
  "active_status": true,
  "username": "john_doe"
}
```

**Login:**
```bash
curl -X POST http://127.0.0.1:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "password": "secure_password"
  }'

# Same response as register
```

**Authenticated Query Analysis:**
```bash
curl -X POST http://127.0.0.1:8000/analysis \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -d '{
    "query": "SELECT * FROM users WHERE id = 1",
    "user_id": 1
  }'
```

## Storage Security

### What is Stored

✅ **Securely Stored in `secretStorage`:**
- `access_token` - JWT token for API authentication
- `user_id` - User's unique identifier
- `username` - User's display name
- `isAuthenticated` - Authentication status

❌ **Never Stored:**
- Password
- Sensitive credentials
- Session secrets

### How It Works

1. **VS Code's `secretStorage`** uses OS-level credential stores:
   - **Windows**: Windows Credential Manager
   - **macOS**: Keychain
   - **Linux**: Pass or custom credential provider

2. **Automatic Encryption**: VS Code encrypts/decrypts automatically

3. **Per-Extension Isolation**: Each extension has its own storage

### Usage in Code

```typescript
// In AuthStorage.ts
async saveAuth(auth: AuthResponse): Promise<void> {
  const authState: AuthState = {
    access_token: auth.access_token,
    user_id: auth.user_id,
    username: auth.username,
    isAuthenticated: true,
  };

  // Encrypted by VS Code's secretStorage
  await this.secretStorage.store(AUTH_STORAGE_KEY, JSON.stringify(authState));
}

async getAuth(): Promise<AuthState> {
  // Automatically decrypted by VS Code
  const stored = await this.secretStorage.get(AUTH_STORAGE_KEY);
  return JSON.parse(stored || '{}');
}
```

## Status Bar Integration

### Visual Indicators

**Not Logged In:**
```
$(sign-in) QRefine Login
└─ Clicking opens login webview
```

**Logged In:**
```
$(account) john_doe
└─ Clicking opens logout confirmation
```

### Code Integration

```typescript
// In AuthManager.ts
private updateStatusBar(): void {
  if (this.isAuthenticated()) {
    this.statusBarItem.text = `$(account) ${this.authState.username}`;
    this.statusBarItem.command = "qrefine.logout";
  } else {
    this.statusBarItem.text = "$(sign-in) QRefine Login";
    this.statusBarItem.command = "qrefine.login";
  }
  this.statusBarItem.show();
}
```

## Commands

### User-Facing Commands

| Command | Keybinding | Action |
|---------|-----------|--------|
| `qrefine.login` | (click status bar) | Open login/signup webview |
| `qrefine.logout` | (click status bar when logged in) | Logout user |

### Internal Commands

| Command | Purpose |
|---------|---------|
| `qrefine.runAnalysis` | Analyze SQL in active file |
| `qrefine.visualizeQueryPlan` | Show query plan visualizer |

## Configuration

### Settings in `package.json`

```json
{
  "contributes": {
    "commands": [
      {
        "command": "qrefine.login",
        "title": "QRefine: Login"
      },
      {
        "command": "qrefine.logout",
        "title": "QRefine: Logout"
      }
    ]
  }
}
```

### Backend Configuration

Set backend URL in `src/auth/client.ts`:

```typescript
const API_BASE_URL = "http://127.0.0.1:8000"; // Change this for production
```

## Error Handling

### Login/Signup Errors

Errors are displayed in the webview:

```
❌ Login Error: Invalid email or password
❌ Registration Error: Email already exists
❌ Network Error: Unable to connect to server
```

### API Errors

When auth token is invalid or expired:

```typescript
// In AuthAPI.request()
if (!response.ok) {
  const error = await response.json();
  throw new Error(error.detail || `Request failed with status ${response.status}`);
}
```

Can be extended to auto-refresh tokens:

```typescript
// TODO: Token refresh flow
if (response.status === 401) {
  // Token expired - refresh or re-login
  await authManager.logout();
  vscode.window.showErrorMessage("Session expired. Please login again.");
}
```

## Testing

### Manual Testing Checklist

- [ ] **First Launch**: Extension shows login prompt
- [ ] **Signup**: New account creation works
- [ ] **Login**: Existing account login works
- [ ] **Storage**: Token persists after reload
- [ ] **Status Bar**: Shows username when logged in
- [ ] **Logout**: Session cleared, status bar resets
- [ ] **API Calls**: Queries sent with auth header
- [ ] **Error Handling**: Shows friendly error messages

### Test Accounts

```
Email: test@example.com
Password: test123
Username: test_user
```

## Future Enhancements

- [ ] OAuth integration (Google, GitHub)
- [ ] Token refresh/expiration handling
- [ ] Multi-account support
- [ ] User profile management
- [ ] API key alternative auth
- [ ] Session timeout configuration
- [ ] Biometric auth (fingerprint/face on supported OS)
- [ ] Remember device option

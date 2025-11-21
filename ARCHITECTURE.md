# QRefine Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    VS Code Editor                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              QRefine Extension                           │   │
│  │  (Main Process: src/extension.ts)                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│              │               │              │                    │
│              ├───────────────┼──────────────┤                    │
│              ▼               ▼              ▼                    │
│    ┌────────────────┐ ┌──────────────┐ ┌─────────────┐         │
│    │ AuthManager    │ │ Analyzer     │ │ Webview     │         │
│    │ (Login/Auth)   │ │ (SQL Rules)  │ │ (Query Plan)│         │
│    └────────────────┘ └──────────────┘ └─────────────┘         │
│              │               │              │                    │
│              ▼               ▼              ▼                    │
│    ┌────────────────────────────────────────────────────┐       │
│    │  Storage & Utilities                               │       │
│    │  ├─ AuthStorage (secretStorage)                    │       │
│    │  ├─ SQL Extractors                                 │       │
│    │  ├─ Query Interceptor                              │       │
│    │  └─ CodeActions (Quick Fix)                        │       │
│    └────────────────────────────────────────────────────┘       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
    ┌─────────────┐      ┌──────────────┐    ┌──────────────┐
    │ OS Keychain │      │ Backend API  │    │ File System  │
    │ (Tokens)    │      │ (Analysis)   │    │ (.sql, .ts)  │
    └─────────────┘      └──────────────┘    └──────────────┘
```

## Component Breakdown

### 1. Authentication Layer

```
AuthManager (src/auth/manager.ts)
    ├── Initialize on startup
    │   ├─ Check secretStorage for existing token
    │   ├─ Restore session if valid
    │   └─ Show login prompt if needed
    │
    ├── Login/Signup flow
    │   ├─ Show AuthWebview (UI)
    │   ├─ Call AuthClient (API)
    │   ├─ Store in AuthStorage
    │   └─ Update status bar
    │
    └─ Status Bar
        ├─ "Login" (not authenticated)
        └─ "Username" (authenticated)

AuthStorage (src/auth/storage.ts)
    ├── Save: Store auth state in secretStorage
    ├── Get: Retrieve auth state from secretStorage
    ├── Clear: Delete auth state
    └── Secure: Encrypted by OS

AuthClient (src/auth/client.ts)
    ├── register(credentials) → POST /auth/register
    ├── login(credentials) → POST /auth/login
    └── validateToken(token) → GET /auth/validate

AuthWebview (src/auth/webview.ts)
    ├── Login Form
    │   ├─ Email input
    │   ├─ Password input
    │   └─ Submit button
    │
    └─ Signup Form
        ├─ Username input
        ├─ Email input
        ├─ Password input
        └─ Submit button
```

### 2. SQL Analysis Layer

```
SQL Extraction (src/utils/sqlExtractors.ts)
    ├── extractTemplateLiterals()
    │   ├─ Find backtick strings
    │   ├─ Replace ${} with ?
    │   └─ Return with confidence score
    │
    ├── extractQuotedStrings()
    │   ├─ Find " and ` quoted strings
    │   ├─ Validate SQL keywords
    │   └─ Filter false positives
    │
    ├── extractConcatenatedStrings()
    │   ├─ Detect + operators
    │   ├─ Mark as DYNAMIC
    │   └─ Suggest runtime interception
    │
    └── validateSQL()
        ├─ Check keywords
        ├─ Count confidence points
        └─ Return { isValid, confidence }

Query Interceptor (src/analyzers/queryInterceptor.ts)
    ├── captureQuery(query, source)
    │   ├─ Store in memory
    │   ├─ Include timestamp
    │   └─ Keep last 100 queries
    │
    ├── sendForAnalysis(query, token)
    │   └─ POST query to backend
    │
    └── @InterceptQuery decorator
        └─ Auto-capture on method call

Static Analyzer (src/staticAnalyzer.ts)
    ├── Load all rules
    ├── Apply each rule to SQL
    ├── Collect suggestions
    └── Return RuleSuggestion[]
```

### 3. Output & Display Layer

```
Diagnostics
    ├─ Create DiagnosticCollection
    ├─ Map RuleSuggestion to vscode.Diagnostic
    ├─ Set severity level
    └─ Show in Problems panel

Decorations (Inline)
    ├─ Create TextEditorDecorationType
    ├─ Render after code line
    ├─ Show severity icon
    └─ Display message

Code Actions (Quick Fix)
    ├─ Register CodeActionProvider
    ├─ Listen for user trigger (Ctrl+.)
    ├─ Suggest fixes
    └─ Apply fix on selection

WebView (Query Plan)
    ├─ Create WebviewPanel
    ├─ Load HTML from media/qrefine-plan.html
    ├─ Send query to backend
    └─ Render graph visualization
```

## Data Flows

### Authentication Flow

```
1. EXTENSION STARTUP
   Extension Activates
   ↓
   AuthManager.initialize()
   ↓
   Check secretStorage
   ├─ If token exists → Restore
   │  └─ Update status bar with username
   └─ If not → Show login prompt
   
2. USER LOGIN
   User clicks "Login" button
   ↓
   AuthWebview.show() → Webview opens
   ↓
   User enters email + password
   ↓
   Webview.postMessage({ type: 'login', ... })
   ↓
   AuthManager receives message
   ↓
   AuthClient.login(credentials)
   ↓
   Backend validates at http://127.0.0.1:8000/auth/login
   ↓
   Returns { access_token, user_id, username }
   ↓
   AuthStorage.saveAuth() → Stored in secretStorage
   ↓
   AuthManager updates state
   ↓
   Status bar shows username
   ↓
   Webview closes
```

### Query Analysis Flow

```
1. STATIC ANALYSIS (Parse-Time)
   File opened/saved
   ↓
   sqlExtractors(document)
   ├─ Extract template literals
   ├─ Extract quoted strings
   └─ Detect concatenations
   ↓
   For each query found:
   ├─ Validate SQL
   ├─ Calculate confidence
   └─ Return SQLQuery[]
   ↓
   staticAnalyzer.analyzeSQL()
   ├─ Apply rule 1 (selectStar)
   ├─ Apply rule 2 (deleteWithoutWhere)
   ├─ Apply rule N (...)
   └─ Return RuleSuggestion[]
   ↓
   Display:
   ├─ Diagnostics (Problems panel)
   ├─ Decorations (Inline)
   └─ Code actions (Quick fix)

2. RUNTIME ANALYSIS (Execution-Time)
   Application executes query
   ↓
   QueryInterceptor.captureQuery()
   ├─ Store query
   ├─ Include timestamp
   └─ Include source function
   ↓
   Query stored in memory
   ↓
   Can send for backend analysis:
   QueryInterceptor.sendForAnalysis(query)
   ↓
   Backend receives authenticated request:
   POST /analysis
   ├─ Authorization: Bearer <token>
   ├─ Body: { query, user_id, ... }
   └─ Returns analysis results
```

### API Authentication Flow

```
1. STORAGE ACCESS TOKEN
   AuthStorage saves to secretStorage
   ├─ OS encrypts (Windows Credential Manager / Keychain)
   └─ Retrieved only by this extension

2. ALL API CALLS
   Use AuthAPI instead of fetch:
   
   await authAPI.post('/analysis', { query })
   ↓
   AuthAPI.request() intercepts
   ├─ Get token: authManager.getAccessToken()
   ├─ Get user: authManager.getUserInfo()
   ├─ Build headers:
   │  ├─ Content-Type: application/json
   │  ├─ Authorization: Bearer <token>
   │  └─ (more headers as needed)
   └─ Execute fetch with headers
   ↓
   Backend receives authenticated request:
   ├─ Extracts token from Authorization header
   ├─ Validates token
   ├─ Extracts user_id from body
   ├─ Processes request with context
   └─ Returns response

3. ERROR HANDLING
   If response not ok:
   ├─ Parse error
   ├─ Show user message
   └─ Log for debugging
   
   Optional: Token expired (401)
   ├─ Clear storage
   ├─ Show re-login prompt
   └─ Retry after login
```

## File Relationships

```
extension.ts (Entry point)
    ├─ imports AuthManager
    │   └─ AuthManager creates
    │       ├─ AuthStorage
    │       ├─ AuthWebview
    │       ├─ AuthClient (static)
    │       └─ Status bar
    │
    ├─ imports AuthAPI
    │   └─ Used by QueryPlanWebview
    │
    ├─ imports sqlExtractors
    │   └─ Called on document save
    │
    ├─ imports staticAnalyzer
    │   └─ Analyzes SQL rules
    │
    └─ imports QueryPlanWebview
        └─ Uses AuthAPI for requests

Auth System (src/auth/)
    ├─ types.ts: TypeScript interfaces
    ├─ storage.ts: SecureStorage wrapper
    ├─ client.ts: API calls
    ├─ api.ts: HTTP helper
    ├─ webview.ts: Login UI
    └─ manager.ts: Orchestrator

Analysis System (src/)
    ├─ staticAnalyzer.ts: Rule runner
    ├─ rules/: Individual rules
    └─ utils/sqlExtractors.ts: Query detection

Interception System (src/analyzers/)
    └─ queryInterceptor.ts: Runtime capture
```

## Query Confidence Scoring

```
validateSQL(content)
    ├─ Check if empty
    │   └─ confidence = 0%
    │
    ├─ Check SQL keywords
    │   ├─ SELECT, INSERT, UPDATE, DELETE, WITH, etc.
    │   └─ confidence += 50%
    │
    ├─ Check structure
    │   ├─ FROM clause (SELECT)? → +30%
    │   ├─ INTO clause (INSERT)? → +30%
    │   └─ SET clause (UPDATE)? → +30%
    │
    ├─ Check SQL patterns
    │   ├─ WHERE? → +10%
    │   ├─ JOIN? → +10%
    │   ├─ ORDER BY? → +5%
    │   └─ GROUP BY? → +5%
    │
    ├─ Check false positives
    │   ├─ import/require? → -50%
    │   └─ URL pattern? → -50%
    │
    └─ Final confidence (capped 0-100%)
        ├─ >70% → High confidence
        ├─ 40-70% → Medium confidence
        ├─ 30-40% → Low confidence
        └─ <30% → Rejected
```

## State Management

```
AuthState (in AuthManager)
    ├─ access_token: string | null
    ├─ user_id: number | null
    ├─ username: string | null
    └─ isAuthenticated: boolean

QueryState (in QueryInterceptor)
    ├─ capturedQueries: CapturedQuery[] (max 100)
    │   └─ Each: { query, timestamp, source, userInfo }
    └─ maxQueriesStored: number

DiagnosticsState (in extension.ts)
    ├─ diagnosticCollection: DiagnosticCollection
    └─ decorationType: TextEditorDecorationType

AnalysisState (in staticAnalyzer.ts)
    └─ rules: SQLRule[] (loaded from src/rules/)
```

## Error Handling Strategy

```
Authentication Errors
    ├─ Network error → Show "Unable to connect"
    ├─ Invalid credentials → Show "Invalid email or password"
    └─ Server error → Show "Server error, try again"

API Errors
    ├─ 400 Bad Request → Show user message
    ├─ 401 Unauthorized → Clear token, prompt login
    ├─ 500 Server Error → Show error details
    └─ Network timeout → Retry or show error

Query Analysis Errors
    ├─ Invalid SQL → Show suggestion
    ├─ Extractor error → Log, skip query
    └─ Backend error → Show in Output panel

User Actions
    ├─ Catch all errors
    ├─ Log to console
    └─ Show friendly message
```

## Performance Considerations

```
Memory:
    ├─ AuthStorage: ~1 KB (token + user info)
    ├─ QueryInterceptor: ~5-10 MB (100 queries max)
    └─ Total overhead: <15 MB

Speed:
    ├─ SQL extraction: <100ms per file
    ├─ Rule application: <200ms per query
    ├─ Auth check: <1ms (in-memory)
    └─ API call: 200-500ms (network)

Optimization:
    ├─ Lazy load components
    ├─ Cache extracted queries
    ├─ Debounce analysis on changes
    └─ Limit file size analysis
```

---

This architecture ensures:
✅ Secure token management
✅ Accurate query detection
✅ Responsive user experience
✅ Easy backend integration
✅ Extensible rule system

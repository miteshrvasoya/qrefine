# SQL Query Extraction & Runtime Analysis - Implementation Guide

## Overview

QRefine now includes an improved SQL query extraction system that handles multiple query patterns and provides runtime query interception for dynamic SQL that can't be statically analyzed.

## Architecture

### 1. Static Analysis (Parse-Time)

Located in: `src/utils/sqlExtractors.ts`

The improved extractor handles three types of SQL queries:

#### a) Template Literals
```typescript
// ✅ Extracted correctly
const query = `
  SELECT id, name FROM users 
  WHERE email = ? 
  AND status = ?
`;

// ✅ With interpolation (replaced with placeholders)
const query = `
  SELECT * FROM users 
  WHERE id = ${userId}
`;
// → Becomes: "SELECT * FROM users WHERE id = ?"
```

#### b) Quoted Strings (Double/Backticks)
```typescript
// ✅ Extracted
const query = "SELECT * FROM orders WHERE id = $1";

// ✅ Multi-line (concatenated)
const query = `
  WITH recent_orders AS (
    SELECT * FROM orders WHERE created_date > NOW() - INTERVAL '30 days'
  )
  SELECT * FROM recent_orders;
`;
```

#### c) Concatenated Strings
```typescript
// ⚠️  Detected as DYNAMIC (can't fully parse)
const query = "SELECT * FROM " + table + " WHERE id = " + userId;
```

### 2. Runtime Interception (Execution-Time)

Located in: `src/analyzers/queryInterceptor.ts`

For queries that can't be statically parsed (dynamic queries):

#### Approach A: Backend Middleware Integration

```typescript
// In your backend API (Node.js/Express):
app.use((req, res, next) => {
  // Capture query before execution
  if (req.body.query) {
    QueryInterceptor.captureQuery(
      req.body.query, 
      "api_endpoint", 
      { user_id: req.user?.id, username: req.user?.username }
    );
  }
  next();
});
```

#### Approach B: Direct Function Hook

```typescript
// In model.ts or db.ts, add @InterceptQuery decorator:
import { InterceptQuery } from "@analyzers/queryInterceptor";

class db {
  @InterceptQuery("executeQuery")
  async executeQuery(query: string, dbtype: string = this.db_type) {
    // ... existing implementation
    this.query = query;
    // Query is automatically captured with timestamp and function name
  }
}
```

#### Approach C: Manual Capture

```typescript
// Explicitly capture in executeQuery:
import { QueryInterceptor } from "@analyzers/queryInterceptor";

async executeQuery(query: string) {
  QueryInterceptor.captureQuery(query, "executeQuery");
  // ... rest of implementation
}
```

## Data Flow

### Static Analysis Flow
```
User saves/opens .ts/.js file
  ↓
Extension detects file type (ts/js)
  ↓
sqlExtractors.ts analyzes file content
  ├─ Extracts template literals
  ├─ Extracts quoted strings
  └─ Detects concatenated strings (marked as DYNAMIC)
  ↓
For each query found:
  ├─ Validate SQL keywords (SELECT, INSERT, UPDATE, etc.)
  ├─ Calculate confidence score (0-100)
  ├─ Generate diagnostics
  └─ Show inline suggestions
  ↓
Backend analysis (if enabled):
  └─ Send queries to /analysis endpoint with auth token
```

### Runtime Interception Flow
```
Application executes query (dynamic)
  ↓
QueryInterceptor.captureQuery() called
  ├─ Stored with timestamp, source, user info
  └─ Recent queries kept in memory (max 100)
  ↓
User can:
  ├─ View captured queries
  ├─ Send for analysis
  └─ Track query patterns
```

## Query Validation & Confidence

The extractor assigns a **confidence score (0-100)** based on:

| Factor | Points | Notes |
|--------|--------|-------|
| Starts with SQL keyword | +50 | SELECT, INSERT, UPDATE, DELETE, WITH, etc. |
| Has FROM clause (SELECT) | +30 | Indicates complete SELECT |
| Has INTO clause (INSERT) | +30 | Indicates complete INSERT |
| Has SET clause (UPDATE) | +30 | Indicates complete UPDATE |
| Has WHERE clause | +10 | Optional but common |
| Has JOIN clause | +10 | Indicates complex query |
| Has ORDER BY | +5 | Optimization indicator |
| Has GROUP BY | +5 | Aggregation indicator |
| Import/require detected | -50 | False positive |
| URL pattern detected | -50 | False positive |

**Minimum confidence to report: 30%**

## Integration with Extension

### In `extension.ts`:

```typescript
import { sqlExtractors } from "./utils/sqlExtractors";
import { QueryInterceptor } from "./analyzers/queryInterceptor";

// When file is saved
vscode.workspace.onDidSaveTextDocument((document) => {
  const ext = document.fileName.split(".").pop();

  if (["js", "ts", "py"].includes(ext || "")) {
    // Extract SQL queries
    const sqlQueries = sqlExtractors(document);
    
    sqlQueries.forEach(query => {
      console.log(`Found ${query.type} query (confidence: ${query.confidence}%)`);
      
      if (query.type === "dynamic") {
        console.log("⚠️  Dynamic query - will be captured at runtime");
      } else if (query.isValid) {
        // Send for static analysis
        sendQueryForAnalysis(query.query);
      }
    });
  }
});

// Get runtime captured queries
const capturedQueries = QueryInterceptor.getRecentQueries(10);
capturedQueries.forEach(q => {
  console.log(`Captured from ${q.source}: ${q.query}`);
});
```

## Best Practices

### ✅ For Static Analysis
1. Use complete SQL strings when possible
2. Use template literals for better readability
3. Avoid string concatenation for SQL

**Good:**
```typescript
const query = `
  SELECT id, name, email 
  FROM users 
  WHERE status = 'active'
`;
```

**Avoid:**
```typescript
const query = "SELECT id, name, email FROM users " +
              "WHERE status = 'active'";
```

### ✅ For Dynamic Queries
1. Ensure backend captures queries before execution
2. Use consistent function names for interception
3. Pass user context for query attribution

**Good:**
```typescript
class db {
  async executeQuery(query: string) {
    // Captured automatically if using decorator or middleware
    QueryInterceptor.captureQuery(query, "executeQuery");
    return await this.default_connection.query(query);
  }
}
```

### ✅ With Authentication
All runtime-captured queries automatically include:
- `user_id` - From auth manager
- `username` - From auth manager
- `access_token` - Sent in Authorization header

```typescript
const analysis = await QueryInterceptor.sendForAnalysis(
  query,
  authManager.getAccessToken(),
  authManager.getUserInfo()?.user_id
);
```

## Limitations & Known Issues

### Static Analysis Limitations
- **Complex SQL**: Very complex queries may not be detected if they span multiple statements
- **Comments**: SQL comments are treated as part of the query
- **String Escape**: Escaped quotes may cause issues
- **Template Expressions**: Complex ${...} expressions are replaced with `?`

### Runtime Interception Limitations
- **Memory Bound**: Only stores last 100 queries in memory
- **No Persistence**: Queries lost on extension reload
- **Optional**: Requires explicit code instrumentation

## Troubleshooting

### Query Not Being Detected

1. **Check query confidence:**
   ```
   Open DevTools (Help → Toggle Developer Tools)
   Check console logs for confidence scores
   ```

2. **Validate SQL syntax:**
   - Ensure query starts with recognized keyword
   - Check for typos in SQL keywords

3. **Check file type:**
   - Only `.js`, `.ts`, `.py` files are analyzed
   - Ensure file has SQL queries in strings/templates

### Dynamic Queries Not Captured

1. **Verify function is called:**
   ```
   Add console.log in executeQuery()
   Check terminal output
   ```

2. **Check interceptor is initialized:**
   ```typescript
   // Verify this runs on backend startup
   import { QueryInterceptor } from "./analyzers/queryInterceptor";
   QueryInterceptor.captureQuery(query, "source");
   ```

## Future Improvements

- [ ] Persist captured queries to database
- [ ] Full SQL parser integration (sqlparse)
- [ ] Multi-file query tracking
- [ ] Query performance profiling
- [ ] AI-powered query suggestions
- [ ] Query cost estimation

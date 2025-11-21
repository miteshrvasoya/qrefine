# QRefine Comprehensive Debugging Guide

## Overview

This guide explains the comprehensive console logging that has been added throughout the QRefine extension to help debug the two critical issues:

1. **Inline suggestions stopped working** - Decorations not appearing on SQL in code files
2. **API not calling on file save** - Backend analysis endpoint not receiving requests

## Console Logging Structure

All console logs follow the format: `[QRefine] EMOJI Message`

This makes them easy to scan in the VS Code Output panel.

### Emoji Key

- 🚀 Startup/initialization
- 🔐 Authentication operations  
- 📂 File operations
- ✅ Success/completion
- ❌ Errors
- 🔍 Analysis operations
- 💾 Save operations
- 🔎 Query extraction
- 📊 Results
- 📋 Output channel operations
- 🌐 Backend/API operations
- ⏱️ Timeout detection
- 🏷️ Classification/tagging
- 👁️ Editor/UI operations
- ✨ Decoration operations
- 🧭 Navigation/flow control
- ⏭️ Skipping/conditions
- 📝 Verbose logging
- ⚠️ Warnings
- 📌 Diagnostic operations
- 🔧 Configuration/setup

## Key Logging Points

### 1. Extension Activation (`src/extension.ts` lines 16-30)

**What it logs:**
- Extension activation start
- AuthManager initialization status
- Active editor availability

**Console output:**
```
[QRefine] 🚀 Extension activated
[QRefine] 🔐 AuthManager initialized
[QRefine] 🔍 Analyzing active editor...
```

### 2. Document Event Listeners (`src/extension.ts` lines 69-80)

**What it logs:**
- When documents are opened
- When documents are changed
- File path and language ID for each event

**Console output:**
```
[QRefine] 📂 Document opened: /path/to/file.ts (language: typescript)
[QRefine] 📂 Document changed: /path/to/file.ts (language: typescript)
```

### 3. File Save Handler (`src/extension.ts` lines 91-230)

**What it logs:**
- File saved event with filename
- File extension detected
- Whether file is processed (js, ts, py check)
- Number of SQL snippets found
- Query type and confidence for each snippet
- Authentication status for backend API
- Backend request preparation
- Backend response status
- Analysis results

**Console output:**
```
[QRefine] 💾 File saved: /path/to/file.ts
[QRefine] 🔍 File extension: ts
[QRefine] ✅ Processing ts file for SQL extraction...
[QRefine] 🔎 Found 2 SQL snippets
[QRefine] 🔍 Query analysis - SELECT *: true, Type: complete, Confidence: 95%
[QRefine] 🌐 Backend API authentication status: ✅ Authenticated
[QRefine] 🚀 Preparing backend API request...
[QRefine] 📤 Sending to backend: {"query":"SELECT * FROM users"...
[QRefine] 📨 Backend response status: 200
[QRefine] ✅ Backend analysis successful: {...}
[QRefine] 📋 Output panel shown
```

### 4. Run Analysis Function (`src/extension.ts` lines 265-287)

**What it logs:**
- Function called with document info
- Language ID check results
- Whether file is .sql or has .sql extension
- Early return reason if applicable
- File passed checks status
- Number of suggestions returned
- Each diagnostic creation
- Decoration application status
- Editor visibility check

**Console output:**
```
[QRefine] 🔍 runAnalysis called for: /path/to/file.sql
[QRefine] 📄 Language ID: sql
[QRefine] 🏷️  Ends with .sql: true
[QRefine] ✅ File passed language/extension check. Running analyzeSQL...
[QRefine] 💡 analyzeSQL returned 3 suggestions
[QRefine] 🔧 Creating diagnostic: SELECT * detected at line 5
[QRefine] 📌 Set 3 diagnostics for file:///path/to/file.sql
[QRefine] 👁️  Found editor for document. Applying 3 decorations...
[QRefine] ✨ Applied decorations to editor
```

## How to Debug Using Console Logs

### Step 1: Launch Extension in Debug Mode

1. Open QRefine workspace in VS Code
2. Press **F5** to launch extension debug session
3. This opens a new VS Code window with the extension loaded

### Step 2: Open Output Panel

In the extension debug window (not main editor):
1. Press **Ctrl+`** (backtick) to open integrated terminal
2. Click the **Output** tab (next to terminal)
3. Select **"QRefine Inline Analysis"** from the dropdown (or look for any QRefine channel)

### Step 3: Reproduce the Issue

**For inline suggestions issue:**
1. Open a TypeScript file with embedded SQL (e.g., `sample_files/db.ts`)
2. Observe console logs - look for:
   - Does `📂 Document opened` appear?
   - Does `runAnalysis called for:` appear?
   - What is the Language ID?
   - Does it say `EARLY RETURN: Not a .sql file`?

**For file save API issue:**
1. Save the TypeScript file (Ctrl+S)
2. Observe console logs - look for:
   - Does `💾 File saved` appear?
   - Does `✅ Processing ts file for SQL extraction...` appear?
   - Does `🔎 Found N SQL snippets` appear?
   - Does `📤 Sending to backend` appear?
   - What is the `📨 Backend response status`?

### Step 4: Trace the Flow

#### If Inline Suggestions Not Working

Look for this sequence:

```
[QRefine] 📂 Document opened: ...
  └─> Check language ID: Is it 'sql'? Or filename ends with .sql?
  └─> If YES → [QRefine] ✅ File passed language/extension check
  └─> If NO → [QRefine] ⏭️  EARLY RETURN: Not a .sql file
```

**If you see EARLY RETURN:** This is the problem! The file is not recognized as SQL.
- **For .ts files with embedded SQL:** This is expected because embedded SQL is in comments/strings, not a .sql file
- **Solution:** The inline analysis for .ts/.js files should use the file save handler (step 3 below), not runAnalysis

#### If API Not Calling on Save

Look for this sequence when you save a .ts file:

```
[QRefine] 💾 File saved: ...
  └─> [QRefine] 🔍 File extension: ts
  └─> [QRefine] ✅ Processing ts file for SQL extraction...
  └─> [QRefine] 🔎 Found N SQL snippets
  
If N > 0:
  └─> [QRefine] 🌐 Backend API authentication status: ...
  └─> [QRefine] 🚀 Preparing backend API request...
  └─> [QRefine] 📤 Sending to backend: ...
  └─> [QRefine] 📨 Backend response status: ...
```

**If you see no logs after "File saved":** Handler not executing
- Check if file extension is in ["js", "ts", "py"]
- Check if there's an error being silently caught

**If you see "Found 0 SQL snippets":** SQL extraction not working
- The SQL extractor is not finding any SQL in the file
- Check the SQL in your test file matches patterns in `src/utils/sqlExtractors.ts`

**If you see response status other than 200:** Backend error
- Check backend is running on port 8000
- Check authentication token is valid
- Check request body is correct format

## Common Debugging Scenarios

### Scenario 1: Inline Suggestions Not Appearing

**Check Points:**
1. Open a .sql file (or .ts with SQL) in editor
2. Look in Output panel for:
   - "Language ID: sql" ✓ or "Language ID: typescript" ✗
   - "EARLY RETURN" message ✗ (if present, this is the problem)
3. Look for:
   - "Found editor for document" ✓
   - "Applied decorations" ✓

**Most Likely Cause:** `runAnalysis` only processes .sql files, not .ts files with embedded SQL

**Solution:** For embedded SQL in .ts/.js files, use the file save handler instead (which does process those extensions)

### Scenario 2: File Save Handler Not Running

**Check Points:**
1. Save a .ts file (Ctrl+S)
2. Look in Output panel for:
   - "💾 File saved:" (if missing, handler not firing)
   - "🔍 File extension:" (if missing, condition not met)

**Possible Causes:**
- Event listener not registered (check lines 91+ in extension.ts)
- File extension not in ["js", "ts", "py"] list
- Silent error in handler

**Debugging Steps:**
1. Try saving different file types (.ts, .js, .py, .sql)
2. Check if any "❌ Inline analysis error" appears
3. Check browser console for JavaScript errors

### Scenario 3: Backend Not Receiving Requests

**Check Points:**
1. Save a .ts file with SQL
2. Look for:
   - "🚀 Preparing backend API request..." ✓
   - "📤 Sending to backend..." ✓
   - "📨 Backend response status: 200" ✓

**If status is not 200:**
- Check backend is running: `curl http://localhost:8000/analysis`
- Check auth token: "🌐 Backend API authentication status: ✅"
- Check request format in console log

**If "Sending to backend" doesn't appear:**
- SQL extraction returned 0 snippets (previous log will show)
- Check your SQL matches extraction patterns

## Console Log Filtering

In VS Code Output panel, you can filter logs:

**Show all QRefine logs:**
```
\[QRefine\]
```

**Show only errors:**
```
❌|error
```

**Show only backend requests:**
```
Backend|🌐|📤|📨
```

**Show only file operations:**
```
💾|📂
```

## Expected Console Log Sequence - Healthy Extension

### Opening a .sql file:
```
[QRefine] 📂 Document opened: /path/file.sql (language: sql)
[QRefine] 🔍 runAnalysis called for: /path/file.sql
[QRefine] 📄 Language ID: sql
[QRefine] 🏷️  Ends with .sql: true
[QRefine] ✅ File passed language/extension check. Running analyzeSQL...
[QRefine] 💡 analyzeSQL returned 2 suggestions
[QRefine] 🔧 Creating diagnostic: Issue 1 at line 0
[QRefine] 🔧 Creating diagnostic: Issue 2 at line 5
[QRefine] 📌 Set 2 diagnostics for file:///path/file.sql
[QRefine] 👁️  Found editor for document. Applying 2 decorations...
[QRefine] ✨ Applied decorations to editor
```

### Saving a .ts file with SQL:
```
[QRefine] 💾 File saved: /path/file.ts
[QRefine] 🔍 File extension: ts
[QRefine] ✅ Processing ts file for SQL extraction...
[QRefine] 🔎 Found 1 SQL snippets
[QRefine] 📝 Extracted SQL: SELECT * FROM users WHERE...
[QRefine] 📊 Analysis returned 1 suggestions
[QRefine] 💡 Suggestion: SELECT * detected
[QRefine] ✅ Set 1 diagnostics for file
[QRefine] 🔎 Has executeQuery: true
[QRefine] ⏱️  Timeout detected: 5000ms
[QRefine] 🌐 Backend API authentication status: ✅ Authenticated
[QRefine] 🔍 Query analysis - SELECT *: true, Type: complete, Confidence: 90%
[QRefine] 🚀 Preparing backend API request...
[QRefine] 📤 Sending to backend: {"query":"SELECT * FROM users"...
[QRefine] 📨 Backend response status: 200
[QRefine] ✅ Backend analysis successful: {...}
[QRefine] 📋 Output panel shown
```

## Troubleshooting Tips

1. **No logs appear at all?**
   - Extension may not be activated
   - Check "QRefine" channel exists in Output dropdown
   - Try opening any file (should trigger activation)

2. **Logs stop appearing after a point?**
   - Silent error likely occurring
   - Check console for JavaScript exceptions
   - Try restarting debug session (Ctrl+Shift+D)

3. **Backend response shows error status?**
   - Check backend server is running (`http://localhost:8000/analysis`)
   - Verify auth token in logs (look for 🌐 line)
   - Check request format in "📤 Sending to backend" log

4. **Can't find Output panel?**
   - In debug window (extension host), press Ctrl+`
   - Click "Output" tab next to Terminal
   - Select dropdown for channel (should say "QRefine Inline Analysis")

## Next Steps After Debugging

1. **Identify the exact failure point** using console logs
2. **Document the failure** (screenshot console output)
3. **Apply targeted fix** based on:
   - If EARLY RETURN in runAnalysis: Need separate inline handler for .ts/.js
   - If no backend logs: Check SQL extraction or auth status
   - If 4xx/5xx status: Check backend configuration
4. **Verify fix** by repeating steps and checking logs reach completion

## Key Files Modified for Debugging

- `src/extension.ts` - Main extension file with all logging
- `src/utils/sqlExtractors.ts` - SQL query extraction (no logging added but is critical)
- `src/auth/manager.ts` - Authentication (logging exists from earlier changes)

All logging statements use `console.log()` which appears in VS Code Output panel when extension runs.

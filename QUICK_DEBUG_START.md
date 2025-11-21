# Quick Start: Debug the Extension

## 60-Second Setup

### 1. Compile (Already Done ✅)
```bash
npm run compile
```

### 2. Launch Debug Session
- Press **F5** in VS Code
- Wait for new window to open with extension loaded

### 3. Open Output Panel
In the **debug window**:
- Press **Ctrl+`** (backtick)
- Click **Output** tab
- Select **"QRefine Inline Analysis"** dropdown

### 4. Test Inline Suggestions Issue

Create test file `test.ts`:
```typescript
const query = "SELECT * FROM users";
```

Watch console for:
- ✅ `📂 Document opened` 
- ✅ `🔍 runAnalysis called for: test.ts`
- ❌ Look for: `⏭️ EARLY RETURN: Not a .sql file`

**If you see EARLY RETURN:** This is the problem! `runAnalysis()` only accepts `.sql` files, not `.ts` files with embedded SQL.

### 5. Test File Save API Issue

Save the `test.ts` file (Ctrl+S):

Watch console for sequence:
```
💾 File saved: test.ts
✅ Processing ts file for SQL extraction...
🔎 Found 1 SQL snippets
📤 Sending to backend: {...}
📨 Backend response status: ???
```

**If you see:**
- ✅ `200` → API working!
- ❌ `Connection refused` → Backend not running
- ❌ `401/403` → Auth token issue
- ❌ `404` → Endpoint not found

---

## What the Logs Tell You

### Inline Suggestions Issue

**Good scenario:**
```
[QRefine] 🔍 runAnalysis called for: file.sql
[QRefine] ✅ File passed language/extension check...
[QRefine] ✨ Applied decorations to editor
```

**Problem scenario:**
```
[QRefine] 🔍 runAnalysis called for: file.ts
[QRefine] ⏭️ EARLY RETURN: Not a .sql file and language is not 'sql'
```

**Analysis:** `runAnalysis()` rejects .ts/.js files. Only processes .sql files.

---

### File Save API Issue

**Good scenario:**
```
[QRefine] 💾 File saved: file.ts
[QRefine] 🔎 Found 3 SQL snippets
[QRefine] 📤 Sending to backend: {...}
[QRefine] 📨 Backend response status: 200
```

**Problem scenario 1 (No SQL found):**
```
[QRefine] 💾 File saved: file.ts
[QRefine] 🔎 Found 0 SQL snippets
```

**Problem scenario 2 (No backend):**
```
[QRefine] 📤 Sending to backend: {...}
[QRefine] ❌ Failed to send inline query to backend: TypeError: fetch failed
```

**Problem scenario 3 (No auth):**
```
[QRefine] 🌐 Backend API authentication status: ❌ Not authenticated
```

---

## Most Important Logs

### For Inline Suggestions (Line 263-266)
```
⏭️ EARLY RETURN: Not a .sql file
```
If you see this, you found the problem!

### For API Calls (Lines 93-221)
```
📤 Sending to backend:
📨 Backend response status:
```
These show if backend API is working.

### For Decorations (Lines 286-297)
```
✨ Applied decorations to editor
⚠️ No visible editor found
```
This shows if inline UI is applied.

---

## Console Output Format

Every log follows: `[QRefine] EMOJI Message`

**Find specific issues by emoji:**
- 🔍 → Analysis operations
- ❌ → Errors
- ⏭️ → Skipped/early return
- 📤📨 → API calls

---

## Step-by-Step Debugging

### Step 1: Open a .ts file with SQL
```typescript
// test.ts
const query = "SELECT * FROM users WHERE id = ?";
```

### Step 2: Watch the logs
- Should see: `📂 Document opened`
- Should see: `🔍 runAnalysis called`

### Step 3: Check for issue
- **If see EARLY RETURN:** Problem #1 - runAnalysis rejects .ts files
- **If don't see any logs:** Handler not firing

### Step 4: Save the file (Ctrl+S)
- Should see: `💾 File saved`
- Should see: `✅ Processing ts file for SQL extraction`
- Should see: `🔎 Found 1 SQL snippets`

### Step 5: Check API logs
- Should see: `📤 Sending to backend`
- Should see: `📨 Backend response status: 200`

### Step 6: Note any ❌ or ⏭️ symbols
- These indicate problems
- Use them to locate the exact issue

---

## Most Likely Issues (by Priority)

### 1. EARLY RETURN in runAnalysis
**Symptom:** No inline decorations on .ts files  
**Log:** `⏭️ EARLY RETURN: Not a .sql file`  
**Cause:** Function only processes .sql files  
**Fix:** Modify runAnalysis to accept .ts/.js files OR create separate inline handler

### 2. No visible editor found
**Symptom:** Inline decorations not showing even on .sql files  
**Log:** `⚠️ No visible editor found for document`  
**Cause:** Editor not in visible list at time of decoration  
**Fix:** Add delay or use different editor lookup method

### 3. Backend not responding
**Symptom:** API request doesn't get response  
**Log:** `❌ Failed to send inline query to backend`  
**Cause:** Backend server not running or wrong URL  
**Fix:** Ensure backend running on http://localhost:8000/analysis

### 4. Auth token not valid
**Symptom:** Backend returns 401/403  
**Log:** `📨 Backend response status: 401`  
**Cause:** User not logged in or token expired  
**Fix:** Log in via `qrefine.login` command

### 5. SQL extraction returning 0
**Symptom:** Backend API not called even after save  
**Log:** `🔎 Found 0 SQL snippets`  
**Cause:** SQL patterns in file don't match regex in sqlExtractors.ts  
**Fix:** Check file contains one of these patterns:
- Backtick template literal: `` const q = `SELECT...`; ``
- Double quoted string: `"SELECT ... FROM ..."`
- Concatenation: `"SELECT" + " * " + "FROM " + table`

---

## Quick Fixes to Try

### If EARLY RETURN is showing:
Edit `src/extension.ts` line 265-266 to accept .ts files:
```typescript
// CHANGE FROM:
if (document.languageId !== "sql" && !document.fileName.endsWith(".sql")) {

// TO:
if (document.languageId !== "sql" && !document.fileName.endsWith(".sql") && !["typescript", "javascript", "python"].includes(document.languageId)) {
```

### If backend returns 4xx error:
Check auth:
```bash
npm run compile
```
Then try logging in: `Ctrl+Shift+P` → `QRefine: Login`

### If SQL not extracted:
Verify your test SQL matches one of these:
- Backticks: `` `SELECT * FROM users` ``
- Quotes: `"SELECT * FROM users"`
- Concatenation: `"SELECT" + " * " + "FROM users"`

---

## Need More Details?

See detailed debugging guide: `DEBUGGING_GUIDE.md`

See exact logging locations: `LOGGING_LOCATIONS.md`

See complete summary: `DEBUG_IMPLEMENTATION_COMPLETE.md`

---

## TL;DR

1. **F5** → Launch debug
2. **Ctrl+`** → Open Output
3. **Save a .ts file** → Check logs
4. **Find EARLY RETURN or ❌** → That's the problem!

Everything else is just details to understand what each log means.

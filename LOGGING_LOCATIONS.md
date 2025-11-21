# Console Logging Locations - Quick Reference

## File: `src/extension.ts`

### Activation Phase (Lines 12-30)

**Line 16:** Extension startup confirmation
```typescript
console.log("[QRefine] 🚀 Extension activated");
```

**Lines 18-22:** AuthManager initialization with status
```typescript
console.log("[QRefine] 🔐 AuthManager initialized");
// ... inside authManager.initialize() callback
console.log("[QRefine] 📝 User logged in:", authManager.getUserInfo());
```

**Lines 24-26:** Active editor analysis
```typescript
if (vscode.window.activeTextEditor) {
  console.log("[QRefine] 🔍 Analyzing active editor...");
  runAnalysis(vscode.window.activeTextEditor.document);
}
```

### Document Event Listeners (Lines 69-80)

**Line 71:** Document opened event
```typescript
console.log(`[QRefine] 📂 Document opened: ${document.fileName} (language: ${document.languageId})`);
```

**Line 74:** Document changed event
```typescript
console.log(`[QRefine] 📂 Document changed: ${document.fileName} (language: ${document.languageId})`);
```

### File Save Handler - SQL Extraction Phase (Lines 91-120)

**Line 93:** File save event confirmation
```typescript
console.log(`[QRefine] 💾 File saved: ${document.fileName}`);
```

**Lines 95-96:** File extension detection
```typescript
const ext = document.fileName.split(".").pop();
console.log(`[QRefine] 🔍 File extension: ${ext}`);
```

**Lines 98-99:** File processing confirmation
```typescript
if (["js", "ts", "py"].includes(ext || "")) {
  console.log(`[QRefine] ✅ Processing ${ext} file for SQL extraction...`);
```

**Lines 101-102:** SQL extraction result
```typescript
const sqlSnippets = sqlExtractors(document);
console.log(`[QRefine] 🔎 Found ${sqlSnippets.length} SQL snippets`);
```

**Lines 104-107:** Per-snippet logging
```typescript
for (const snippet of sqlSnippets) {
  console.log(`[QRefine] 📝 Extracted SQL: ${snippet.query.substring(0, 50)}...`);
  const analysis = analyzeSQL({ text: snippet.query });
  console.log(`[QRefine] 📊 Analysis returned ${analysis.length} suggestions`);
```

**Lines 109-115:** Diagnostic creation
```typescript
for (const result of analysis) {
  console.log(`[QRefine] 💡 Suggestion: ${result.message}`);
  diagnostics.push(/* ... */);
}
```

**Lines 118-119:** Diagnostic collection update
```typescript
diagnosticCollection.set(document.uri, diagnostics);
console.log(`[QRefine] ✅ Set ${diagnostics.length} diagnostics for file`);
```

### File Save Handler - Backend API Phase (Lines 122-229)

**Lines 123-126:** Document text analysis
```typescript
const documentText = document.getText();
const hasExecuteQuery = documentText.includes("executeQuery(");
console.log(`[QRefine] 🔎 Has executeQuery: ${hasExecuteQuery}`);
```

**Lines 128-135:** Timeout detection
```typescript
let timeout: number | null = null;
const timeoutMatch = documentText.match(/timeout\s*[:=]\s*(\d+)/i);
if (timeoutMatch) {
  const parsed = parseInt(timeoutMatch[1], 10);
  if (!isNaN(parsed)) {
    timeout = parsed;
    console.log(`[QRefine] ⏱️  Timeout detected: ${timeout}ms`);
  }
}
```

**Line 138:** Authentication status
```typescript
console.log(`[QRefine] 🌐 Backend API authentication status: ${authManager.isAuthenticated() ? "✅ Authenticated" : "❌ Not authenticated"}`);
```

**Lines 141-143:** Query validity check
```typescript
if (!snippet.query || !snippet.query.trim()) {
  console.log("[QRefine] ⚠️  Skipping empty query");
  continue;
}
```

**Lines 146-147:** Query analysis logging
```typescript
const usesSelectStar = /select\s+\*/i.test(snippet.query);
console.log(`[QRefine] 🔍 Query analysis - SELECT *: ${usesSelectStar}, Type: ${snippet.type}, Confidence: ${snippet.confidence}%`);
```

**Line 170:** Backend request preparation
```typescript
console.log("[QRefine] 🚀 Preparing backend API request...");
```

**Line 188:** Backend request sending
```typescript
console.log(`[QRefine] 📤 Sending to backend: ${JSON.stringify(body).substring(0, 100)}...`);
```

**Line 193:** Backend response status
```typescript
console.log(`[QRefine] 📨 Backend response status: ${response.status}`);
```

**Lines 194-197:** Backend error handling
```typescript
if (!response.ok) {
  console.error(`[QRefine] ❌ Backend error: ${response.status}`);
  backendOutput.appendLine(`Backend responded with status ${response.status}`);
  continue;
}
```

**Lines 201-203:** Successful backend response
```typescript
const result = await response.json();
console.log("[QRefine] ✅ Backend analysis successful:", result);
backendOutput.appendLine("[QRefine] Backend analysis result received.");
```

**Lines 205-206:** Backend API error
```typescript
catch (err) {
  console.error("[QRefine] ❌ Failed to send inline query to backend:", err);
```

**Lines 213-214:** Output panel display
```typescript
backendOutput.show(true);
console.log("[QRefine] 📋 Output panel shown");
```

**Lines 216-218:** Main catch block for inline analysis errors
```typescript
catch (e) {
  console.error("[QRefine] ❌ Inline analysis error:", e);
  backendOutput.appendLine("[QRefine] Inline analysis error: " + String(e));
}
```

**Lines 219-221:** Unsupported file type
```typescript
} else {
  console.log(`[QRefine] ⏭️  Skipping analysis - unsupported file type: ${ext}`);
}
```

### RunAnalysis Function - Inline Analysis Phase (Lines 257-297)

**Lines 258-261:** Function entry and language check
```typescript
function runAnalysis(document: vscode.TextDocument) {
  console.log(`[QRefine] 🔍 runAnalysis called for: ${document.fileName}`);
  console.log(`[QRefine] 📄 Language ID: ${document.languageId}`);
  console.log(`[QRefine] 🏷️  Ends with .sql: ${document.fileName.endsWith(".sql")}`);
```

**Lines 263-266:** Early return check - **CRITICAL FOR DEBUGGING**
```typescript
if (document.languageId !== "sql" && !document.fileName.endsWith(".sql")) {
  console.log(`[QRefine] ⏭️  EARLY RETURN: Not a .sql file and language is not 'sql'. Skipping analysis.`);
  return;
}
```

**Lines 269-270:** File passed checks
```typescript
console.log("[QRefine] ✅ File passed language/extension check. Running analyzeSQL...");
const suggestions = analyzeSQL({ document });
console.log(`[QRefine] 💡 analyzeSQL returned ${suggestions.length} suggestions`);
```

**Lines 273-282:** Diagnostic creation
```typescript
// Diagnostics
const diagnostics: vscode.Diagnostic[] = suggestions.map((s: any) => {
  console.log(`[QRefine] 🔧 Creating diagnostic: ${s.message} at line ${s.range.start.line}`);
  // ... diagnostic creation
  return diagnostic;
});
diagnosticCollection.set(document.uri, diagnostics);
console.log(`[QRefine] 📌 Set ${diagnostics.length} diagnostics for ${document.uri}`);
```

**Lines 286-297:** Decoration application - **CRITICAL FOR DEBUGGING**
```typescript
// Inline decorations
const editor = vscode.window.visibleTextEditors.find(
  e => e.document.uri.toString() === document.uri.toString()
);
if (editor) {
  console.log(`[QRefine] 👁️  Found editor for document. Applying ${suggestions.length} decorations...`);
  const decorations: vscode.DecorationOptions[] = suggestions.map((s: any) => ({
    // ... decoration options
  }));
  editor.setDecorations(decorationType, decorations);
  console.log(`[QRefine] ✨ Applied decorations to editor`);
} else {
  console.log(`[QRefine] ⚠️  No visible editor found for document. Decorations NOT applied.`);
}
```

## Logging Disabled Functions

None - all logging is **enabled by default**.

## How to View Logs

### In Debug Session:
1. Launch extension: **F5**
2. Open debug window's Output panel: **Ctrl+`** then click "Output" tab
3. Select "QRefine Inline Analysis" from dropdown
4. All console.log statements appear here in real-time

### Log Format:
All logs follow: `[QRefine] EMOJI Message`

This makes them easy to:
- Filter in Output panel
- Scan visually
- Correlate with code sections

## Critical Debugging Points

### For Inline Suggestions Issue:
Lines 263-266 will show if file is being rejected by `runAnalysis()`

### For API Call Issue:
Lines 93-221 will show the complete file save flow with all API communication details

### For Decoration Application Issue:
Lines 286-297 will show if editor is found and decorations applied

## Total Console Statements Added

- **30+** console.log statements
- **3** console.error statements
- **All** follow `[QRefine] EMOJI` format
- **Zero** breaking changes to functionality
- **Full** trace from file event to backend response

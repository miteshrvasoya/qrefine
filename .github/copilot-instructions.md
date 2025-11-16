# QRefine AI Coding Agent Instructions

This document guides AI agents in contributing to QRefine, a VS Code SQL analysis extension.

## Project Overview

QRefine is a **VS Code extension** (TypeScript) that provides real-time SQL analysis with inline suggestions and quick fixes. It detects SQL anti-patterns and unsafe operations directly in the editor.

**Key architecture:**
- Static rule-based analysis (no DB required by default)
- Webview-based query plan visualizer (communicates with backend via fetch)
- Extensible rule framework for adding new SQL checks
- VS Code command/status bar integration

## Build & Development Workflow

```bash
npm run compile          # TypeScript → JavaScript (outDir: dist/)
npm run watch           # Watch-mode compilation (active in workspace)
npm run test            # Run tests (requires pretest hook)
npm run lint            # ESLint check (src/ only)
```

**Important:** The `watch` task is typically running in the workspace. New TS changes auto-compile to `dist/extension.js`, which VS Code loads on extension activation.

### Testing & Debugging

- Tests use VS Code Test CLI (`@vscode/test-electron`) with Mocha
- Test files: `src/test/*.test.ts`
- **Test pattern:** Always verify linting passes before running tests (`npm run pretest`)

## Core Architecture & Data Flows

### 1. Static SQL Analysis Pipeline

**File:** `src/staticAnalyzer.ts`

```
User opens/edits .sql file
  → vscode.onDidOpenTextDocument / onDidChangeTextDocument
  → runAnalysis() calls analyzeSQL()
  → All rules in src/rules/* apply() methods run in sequence
  → RuleSuggestion[] returned → Diagnostics + Decorations
```

**Key types:**
- `RuleSuggestion`: `{ message, range, code, severity, fix? }`
- `SQLRule`: `{ id, description, apply(text, document) }`

### 2. Rules System

**Location:** `src/rules/` — Each rule is a standalone file exporting a `SQLRule` object.

**Pattern:** Use regex or simple string matching on the SQL text. Examples:
- `selectStar.ts`: Matches `\bSELECT\s+\*` (case-insensitive)
- `deleteWithoutWhere.ts`: Matches `DELETE` not followed by `WHERE`

**Adding a new rule:**
1. Create `src/rules/myNewRule.ts`
2. Export object satisfying `SQLRule` interface
3. Add to `src/rules/index.ts` exports array
4. Rules run in order; no dependencies between them

### 3. Webview Communication (Query Plan Visualizer)

**File:** `src/webview/queryPlanWebview.ts`

```
User runs "QRefine: Visualize Query Plan" command
  → Creates webview panel (beside editor)
  → Sends POST to http://localhost:8000/analysis
  → Backend returns { plan, visual, suggestions, warnings }
  → webview.postMessage({ type: 'analyzeResponse', payload: result })
  → Frontend (qrefine-plan.html) renders graph + suggestions
```

**Note:** Webview HTML is loaded from `media/qrefine-plan.html` and uses React/CDN + vis-network.

### 4. Code Actions (Quick Fixes)

**File:** `src/codeActions.ts`

- Implements `vscode.CodeActionProvider`
- Triggered by "Quick Fix" (Ctrl+.) on diagnostics
- Each diagnostic can have a `code` field linked to rule-specific fixes
- Supports "Fix All" for multiple issues in one file

## Project-Specific Conventions

### Naming & Structure

- **Commands:** kebab-case (`qrefine.visualizeQueryPlan`, `qrefine.runAnalysis`)
- **Rules:** camelCase files (`selectStar.ts`, `deleteWithoutWhere.ts`)
- **Severity levels:** `"error" | "warning" | "info"` (mapped to VS Code DiagnosticSeverity)

### Configuration

Settings stored in `package.json` contributes → `qrefine.*`:

```json
"qrefine.db.host", "qrefine.db.port", "qrefine.db.user", 
"qrefine.db.password", "qrefine.db.database"
```

Read via: `vscode.workspace.getConfiguration("qrefine").get("db.host")`

### SQL Extraction from Code Files

**File:** `src/utils/sqlExtractors.ts`

Extracts SQL snippets embedded in `.js`, `.ts`, `.py` files (e.g., inside template literals or strings). Used in `extension.ts` `onDidSaveTextDocument` hook.

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/extension.ts` | Entry point; registers commands, listeners, providers |
| `src/staticAnalyzer.ts` | Rule orchestration; returns RuleSuggestion[] |
| `src/rules/index.ts` | Central export of all rule definitions |
| `src/types.ts` | TypeScript interfaces (SQLRule, RuleSuggestion, etc.) |
| `src/webview/queryPlanWebview.ts` | Webview panel creation + backend communication |
| `src/codeActions.ts` | Quick Fix provider for diagnostics |
| `media/qrefine-plan.html` | Webview UI (React + vis-network graph) |
| `package.json` | Extension manifest (activationEvents, contributes, scripts) |

## Common Tasks & Patterns

### Add a New SQL Rule

1. Create rule file `src/rules/myRule.ts`:
   ```typescript
   import { SQLRule } from "../types";
   
   export const myRule: SQLRule = {
     id: "my-rule",
     description: "Detects my SQL pattern",
     apply(text: string, document: vscode.TextDocument) {
       const regex = /mypattern/gi;
       const matches = [...text.matchAll(regex)];
       return matches.map(m => ({
         range: /* calculate from match position */,
         message: "My pattern detected",
         code: "my-rule",
         severity: "warning"
       }));
     }
   };
   ```
2. Add to `src/rules/index.ts`: `export const rules = [..., myRule]`
3. Add test in `src/test/extension.test.ts` if applicable

### Communicate with Backend

```typescript
const response = await fetch('http://localhost:8000/analysis', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, explain_only: false })
});
const result = await response.json();
```

Errors should show user-facing messages via `vscode.window.showErrorMessage()`.

### Range Calculations

Ranges are `vscode.Range(start: Position, end: Position)` where `Position(line, character)` is 0-indexed.

For embedded SQL, offset is applied in `staticAnalyzer.ts`:
```typescript
if (text && !document) {
  s.range = new vscode.Range(
    new vscode.Position(s.range.start.line, s.range.start.character + offset),
    ...
  );
}
```

## Integration Points & External Dependencies

- **VS Code API:** `vscode` package (devDependency, global in extension context)
- **Database:** `pg` (PostgreSQL client, only imported in `dbClient.ts`—optional for core features)
- **Build tool:** Webpack (configured in `webpack.config.js`, watch task uses `tsc` directly)
- **Backend API:** Expected at `http://localhost:8000` (e.g., `/analysis` endpoint for query plan)

## Documentation & Testing

- **README.md:** User-facing features and setup instructions
- **Tests:** Run via `npm test`; use `@vscode/test-electron` for VS Code integration
- **Linting:** ESLint enforced; see `eslint.config.mjs`

## Current Limitations & Known Patterns

- Rules use basic regex/string matching (no full SQL parser)
- Webview requires backend service running on port 8000
- Database connectivity is optional; core features work offline
- No authentication/session management (relevant for upcoming features)

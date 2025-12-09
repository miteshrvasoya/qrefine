import * as vscode from "vscode";
const WebSocket = require("ws");

import { analyzeSQL } from "./staticAnalyzer";
import { showInlineSuggestions } from "./decorations";
import { QRefineCodeActionProvider } from "./codeActions";
import { sqlExtractors } from "./utils/sqlExtractors";
import { QueryPlanWebview } from "./webview/queryPlanWebview";
import { AuthManager } from "./auth/manager";
import { AuthAPI } from "./auth/api";
import { EnvironmentConfig } from "./config/environment";

let diagnosticCollection: vscode.DiagnosticCollection;
let decorationType: vscode.TextEditorDecorationType;
let statusBarItem: vscode.StatusBarItem;
let authManager: AuthManager;
let authAPI: AuthAPI;
let queryPlanWebview: QueryPlanWebview;
let ws: any = null;

export function activate(context: vscode.ExtensionContext) {
  console.log("[QRefine] 🚀 Extension activated");

  // Detect and configure environment
  // context.extensionMode: 1 = Production, 2 = Development
  const extensionMode = context.extensionMode === vscode.ExtensionMode.Production ? "production" : "development";
  EnvironmentConfig.detectEnvironment(extensionMode);
  const baseUrl = EnvironmentConfig.getApiBaseUrl();
  const environment = EnvironmentConfig.getEnvironment();
  console.log(`[QRefine] 🌍 Environment: ${environment} | API Base URL: ${baseUrl}`);

  // Initialize authentication
  console.log("[QRefine] 📝 Initializing AuthManager...");
  authManager = new AuthManager(context.extensionUri, context.secrets);
  authAPI = new AuthAPI(authManager);
  context.subscriptions.push(authManager.getStatusBarItem());

  authManager.initialize().then(() => {
    connectWebSocket();
  }).catch(err => {
    console.error("[QRefine] ❌ Auth initialization error:", err);
  });

  diagnosticCollection = vscode.languages.createDiagnosticCollection("qrefine");
  context.subscriptions.push(diagnosticCollection);

  decorationType = vscode.window.createTextEditorDecorationType({
    after: { margin: "0 0 0 1em", fontStyle: "italic" },
  });
  context.subscriptions.push(decorationType);

  const runAnalysisCommand = vscode.commands.registerCommand("qrefine.runAnalysis", () => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      runAnalysis(editor.document);
      vscode.window.showInformationMessage("QRefine: Analysis complete ✅");
    } else {
      vscode.window.showWarningMessage("QRefine: No active SQL file to analyze");
    }
  });
  context.subscriptions.push(runAnalysisCommand);

  // Login command
  const loginCommand = vscode.commands.registerCommand("qrefine.login", async () => {
    await authManager.showAuthWebview();
    connectWebSocket();
  });
  context.subscriptions.push(loginCommand);

  // Logout command
  const logoutCommand = vscode.commands.registerCommand("qrefine.logout", async () => {
    await authManager.logout();
    if (ws) {
      ws.close();
      ws = null;
    }
  });
  context.subscriptions.push(logoutCommand);

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
  statusBarItem.text = "$(light-bulb) QRefine";
  statusBarItem.tooltip = "Run SQL Query Analysis";
  statusBarItem.command = "qrefine.runAnalysis";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => statusBarItem.show()));
  context.subscriptions.push(vscode.window.onDidChangeWindowState(() => statusBarItem.show()));

  // Auto analysis
  console.log("[QRefine] 📂 Setting up document listeners...");
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(document => {
      console.log(`[QRefine] 📂 Document opened: ${document.fileName} (lang: ${document.languageId})`);
      runAnalysis(document);
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => {
      console.log(`[QRefine] ✏️  Document changed: ${event.document.fileName}`);
      runAnalysis(event.document);
    })
  );

  if (vscode.window.activeTextEditor) {
    console.log("[QRefine] 🔍 Analyzing active editor...");
    runAnalysis(vscode.window.activeTextEditor.document);
  }

  // Register quick fixes
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: "sql" },
      new QRefineCodeActionProvider(),
      { providedCodeActionKinds: QRefineCodeActionProvider.providedCodeActionKinds }
    )
  );

  const backendOutput = vscode.window.createOutputChannel("QRefine Inline Analysis");
  console.log("[QRefine] 📋 Output channel created");

  vscode.workspace.onDidSaveTextDocument(async (document) => {
    console.log(`[QRefine] 💾 File saved: ${document.fileName}`);
    const ext = document.fileName.split(".").pop();
    console.log(`[QRefine] 🔍 File extension: ${ext}`);

    if (["js", "ts", "py", "go"].includes(ext || "")) {
      console.log(`[QRefine] ✅ Processing ${ext} file for SQL extraction...`);
      const sqlSnippets = sqlExtractors(document, document.languageId);
      console.log(`[QRefine] 🔎 Found ${sqlSnippets.length} SQL snippets`);

      const diagnostics: vscode.Diagnostic[] = [];

      for (const snippet of sqlSnippets) {
        console.log(`[QRefine] 📝 Extracted SQL: ${snippet.query.substring(0, 50)}...`);
        const analysis = analyzeSQL({ text: snippet.query });
        console.log(`[QRefine] 📊 Analysis returned ${analysis.length} suggestions`);

        for (const result of analysis) {
          console.log(`[QRefine] 💡 Suggestion: ${result.message}`);
          diagnostics.push(
            new vscode.Diagnostic(
              snippet.range,
              result.message,
              // result.severity
            )
          );
        }
      }

      diagnosticCollection.set(document.uri, diagnostics);
      console.log(`[QRefine] ✅ Set ${diagnostics.length} diagnostics for file`);

      try {
        const documentText = document.getText();
        const hasExecuteQuery = documentText.includes("executeQuery(");
        console.log(`[QRefine] 🔎 Has executeQuery: ${hasExecuteQuery}`);

        let timeout: number | null = null;
        const timeoutMatch = documentText.match(/timeout\s*[:=]\s*(\d+)/i);
        if (timeoutMatch) {
          const parsed = parseInt(timeoutMatch[1], 10);
          if (!isNaN(parsed)) {
            timeout = parsed;
            console.log(`[QRefine] ⏱️  Timeout detected: ${timeout}ms`);
          }
        }

        console.log(`[QRefine] 🌐 Backend API authentication status: ${authManager.isAuthenticated() ? "✅ Authenticated" : "❌ Not authenticated"}`);

        for (const snippet of sqlSnippets) {
          if (!snippet.query || !snippet.query.trim()) {
            console.log("[QRefine] ⚠️  Skipping empty query");
            continue;
          }

          const usesSelectStar = /select\s+\*/i.test(snippet.query);
          console.log(`[QRefine] 🔍 Query analysis - SELECT *: ${usesSelectStar}, Type: ${snippet.type}, Confidence: ${snippet.confidence}%`);

          backendOutput.appendLine("[QRefine] Sending inline query for analysis:");
          backendOutput.appendLine(`File: ${document.fileName}`);
          backendOutput.appendLine(`Range: ${snippet.range.start.line}:${snippet.range.start.character} - ${snippet.range.end.line}:${snippet.range.end.character}`);
          backendOutput.appendLine(`Query Type: ${snippet.type}`);
          backendOutput.appendLine(`Confidence: ${snippet.confidence}%`);
          backendOutput.appendLine(`Has executeQuery in file: ${hasExecuteQuery}`);
          backendOutput.appendLine(`Detected timeout: ${timeout !== null ? timeout + " ms" : "none"}`);
          backendOutput.appendLine(`Uses SELECT *: ${usesSelectStar}`);
          backendOutput.appendLine(`Query: ${snippet.query}`);
          backendOutput.appendLine("----");

          try {
            console.log("[QRefine] 🚀 Preparing backend API request...");
            const config = vscode.workspace.getConfiguration("qrefine");
            const dbProfile = {
              type: config.get<string>("db.type", "postgres"),
              host: config.get<string>("db.host", "localhost"),
              port: config.get<number>("db.port", 5432),
              user: config.get<string>("db.user", "postgres"),
              password: config.get<string>("db.password", ""),
              database: config.get<string>("db.database", "mydb"),
            };

            const payload = {
              query: snippet.query,
              explain_only: false,
              source_file: document.fileName,
              range: {
                start: {
                  line: snippet.range.start.line,
                  character: snippet.range.start.character,
                },
                end: {
                  line: snippet.range.end.line,
                  character: snippet.range.end.character,
                },
              },
              has_execute_query: hasExecuteQuery,
              timeout,
              flags: {
                uses_select_star: usesSelectStar,
              },
              db_profile: dbProfile
            };

            console.log(`[QRefine] 📤 Sending to backend: ${JSON.stringify(payload).substring(0, 100)}...`);
            const baseUrl = EnvironmentConfig.getApiBaseUrl();
            const response = await authAPI.request(`${baseUrl}/analysis`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            console.log(`[QRefine] 📨 Backend response status: ${response.status}`);
            if (!response.ok) {
              console.error(`[QRefine] ❌ Backend error: ${response.status}`);
              backendOutput.appendLine(`Backend responded with status ${response.status}`);
              continue;
            }

            const result = await response.json();
            console.log("[QRefine] ✅ Backend analysis successful:", result);
            backendOutput.appendLine("[QRefine] Backend analysis result received.");
            backendOutput.appendLine(JSON.stringify(result));
          } catch (err) {
            console.error("[QRefine] ❌ Failed to send inline query to backend:", err);
            backendOutput.appendLine("[QRefine] Failed to send inline query to backend: " + String(err));
          }
        }

        backendOutput.show(true);
        console.log("[QRefine] 📋 Output panel shown");
      } catch (e) {
        console.error("[QRefine] ❌ Inline analysis error:", e);
        backendOutput.appendLine("[QRefine] Inline analysis error: " + String(e));
      }
    } else {
      console.log(`[QRefine] ⏭️  Skipping analysis - unsupported file type: ${ext}`);
    }
  });

  queryPlanWebview = new QueryPlanWebview(context.extensionUri, authAPI);

  const visualizeQueryPlanCommand = vscode.commands.registerCommand(
    'qrefine.visualizeQueryPlan',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('No active editor found.');
        return;
      }

      const selection = editor.selection;
      const queryText = editor.document.getText(selection) || editor.document.getText();

      console.log("Query WebView is opening for query:", queryText);

      if (!queryText.trim()) {
        vscode.window.showWarningMessage('No query found to analyze.');
        return;
      }

      // Async visualization
      try {
        const baseUrl = EnvironmentConfig.getApiBaseUrl();
        const config = vscode.workspace.getConfiguration("qrefine");
        const dbProfile = {
          type: config.get<string>("db.type", "postgres"),
          host: config.get<string>("db.host", "localhost"),
          port: config.get<number>("db.port", 5432),
          user: config.get<string>("db.user", "postgres"),
          password: config.get<string>("db.password", ""),
          database: config.get<string>("db.database", "mydb"),
        };

        const payload = {
          query: queryText,
          explain_only: false,
          source_file: editor.document.fileName,
          db_profile: dbProfile
        };

        const response = await authAPI.request(`${baseUrl}/analysis/visualize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Failed to queue visualization: ${response.status}`);
        }

        vscode.window.showInformationMessage("QRefine: Visualization queued. You will be notified when ready.");

      } catch (err: any) {
        vscode.window.showErrorMessage(`QRefine: Visualization failed. ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  );

  context.subscriptions.push(visualizeQueryPlanCommand);

  // Share selected text with backend for asynchronous analysis over sockets.
  const shareSelectionCommand = vscode.commands.registerCommand(
    "qrefine.shareSelectionForAnalysis",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("QRefine: No active editor to share query from.");
        return;
      }

      if (!authManager || !authManager.isAuthenticated()) {
        vscode.window.showInformationMessage(
          "QRefine: Please login to share queries for analysis.",
          "Login"
        ).then(selection => {
          if (selection === "Login") {
            vscode.commands.executeCommand("qrefine.login");
          }
        });
        return;
      }

      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);
      const queryText = selectedText || editor.document.getText();

      if (!queryText.trim()) {
        vscode.window.showWarningMessage("QRefine: No query text found in the current editor.");
        return;
      }

      try {
        const document = editor.document;
        const baseUrl = EnvironmentConfig.getApiBaseUrl();

        const config = vscode.workspace.getConfiguration("qrefine");
        const dbProfile = {
          type: config.get<string>("db.type", "postgres"),
          host: config.get<string>("db.host", "localhost"),
          port: config.get<number>("db.port", 5432),
          user: config.get<string>("db.user", "postgres"),
          password: config.get<string>("db.password", ""),
          database: config.get<string>("db.database", "mydb"),
        };

        const payload = {
          query: queryText,
          explain_only: false,
          source_file: document.fileName,
          range: {
            start: {
              line: selection.start.line,
              character: selection.start.character,
            },
            end: {
              line: selection.end.line,
              character: selection.end.character,
            },
          },
          db_profile: dbProfile
        };

        const response = await authAPI.request(`${baseUrl}/analysis/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        console.log("Payload: ", payload);
        console.log("Response: ", response);

        if (!response.ok) {
          throw new Error(`Analysis failed with status: ${response.status}`);
        }

        const result = await response.json();

        vscode.window.showInformationMessage("QRefine: Analysis queued. You will be notified when ready.");

      } catch (err) {
        console.error("[QRefine] Analysis error:", err);
        vscode.window.showErrorMessage(`QRefine: Analysis failed. ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  );

  context.subscriptions.push(shareSelectionCommand);

}

function connectWebSocket() {
  if (ws) return;

  const token = authManager.getAccessToken();
  if (!token) {
    console.log("[QRefine] ⚠️ No access token available for WebSocket connection.");
    return;
  }

  const baseUrl = EnvironmentConfig.getApiBaseUrl();
  const wsUrl = baseUrl.replace(/^http/, "ws") + "/ws/analysis?token=" + token;

  console.log(`[QRefine] 🔌 Connecting to WebSocket: ${wsUrl}`);
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("[QRefine] ✅ WebSocket connected");
  };

  ws.onmessage = (event: any) => {
    try {
      const data = JSON.parse(event.data as string);
      console.log("[QRefine] 📩 WebSocket message:", data);

      if (data.type === "analysis_complete") {
        if (data.analysis_type === "visualization") {
          // Automatically open webview for visualization requests
          if (data.analysis_id) {
            queryPlanWebview.loadAnalysis(data.analysis_id);
          }
        } else {
          // Show notification for standard analysis
          vscode.window.showInformationMessage(
            `QRefine: Analysis Ready! ${data.summary || ""}`,
            "View Analysis"
          ).then(selection => {
            if (selection === "View Analysis") {
              if (data.analysis_id) {
                queryPlanWebview.loadAnalysis(data.analysis_id);
              } else {
                console.error("[QRefine] ❌ Received analysis_complete without analysis_id.");
              }
            }
          });
        }
      }
    } catch (e) {
      console.error("[QRefine] ❌ WebSocket message error:", e);
    }
  };

  ws.onclose = () => {
    console.log("[QRefine] 🔌 WebSocket disconnected");
    ws = null;
    // Reconnect logic could go here if desired
  };

  ws.onerror = (e: any) => {
    console.error("[QRefine] ❌ WebSocket error:", e);
    if (ws) {
      ws.close(); // Ensure the socket is closed on error
    }
    ws = null;
  };
}

function runAnalysis(document: vscode.TextDocument) {
  console.log(`[QRefine] 🔍 runAnalysis called for: ${document.fileName}`);
  console.log(`[QRefine] 📄 Language ID: ${document.languageId}`);
  console.log(`[QRefine] 🏷️  Ends with .sql: ${document.fileName.endsWith(".sql")}`);

  if (document.languageId !== "sql" && !document.fileName.endsWith(".sql")) {
    console.log(`[QRefine] ⏭️  EARLY RETURN: Not a .sql file and language is not 'sql'. Skipping analysis.`);
    return;
  }

  console.log("[QRefine] ✅ File passed language/extension check. Running analyzeSQL...");
  const suggestions = analyzeSQL({ document });
  console.log(`[QRefine] 💡 analyzeSQL returned ${suggestions.length} suggestions`);

  // Diagnostics
  const diagnostics: vscode.Diagnostic[] = suggestions.map((s: any) => {
    console.log(`[QRefine] 🔧 Creating diagnostic: ${s.message} at line ${s.range.start.line}`);
    const severity =
      s.severity === "error"
        ? vscode.DiagnosticSeverity.Error
        : s.severity === "warning"
          ? vscode.DiagnosticSeverity.Warning
          : vscode.DiagnosticSeverity.Information;

    const diagnostic = new vscode.Diagnostic(s.range, s.message, severity);
    diagnostic.source = "QRefine";
    diagnostic.code = s.code; // ✅ attach rule code
    return diagnostic;
  });
  diagnosticCollection.set(document.uri, diagnostics);
  console.log(`[QRefine] 📌 Set ${diagnostics.length} diagnostics for ${document.uri}`);

  // Inline decorations
  const severityIcons: Record<string, string> = { error: "🔴", warning: "⚠️", info: "ℹ️" };
  const severityColors: Record<string, string> = { error: "red", warning: "orange", info: "gray" };

  const editor = vscode.window.visibleTextEditors.find(
    e => e.document.uri.toString() === document.uri.toString()
  );
  if (editor) {
    console.log(`[QRefine] 👁️  Found editor for document. Applying ${suggestions.length} decorations...`);
    const decorations: vscode.DecorationOptions[] = suggestions.map((s: any) => ({
      range: s.range,
      renderOptions: {
        after: {
          contentText: `${severityIcons[s.severity]} ${s.message}`,
          color: severityColors[s.severity],
        },
      },
    }));
    editor.setDecorations(decorationType, decorations);
    console.log(`[QRefine] ✨ Applied decorations to editor`);
  } else {
    console.log(`[QRefine] ⚠️  No visible editor found for document. Decorations NOT applied.`);
  }
}

export function deactivate() {
  if (diagnosticCollection) diagnosticCollection.dispose();
  if (decorationType) decorationType.dispose();
  if (statusBarItem) statusBarItem.dispose();
  if (authManager) authManager.dispose();
}

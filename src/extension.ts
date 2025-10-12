import * as vscode from "vscode";
import { analyzeSQL } from "./staticAnalyzer";
import { showInlineSuggestions } from "./decorations";
import { QRefineCodeActionProvider } from "./codeActions";
import { sqlExtractors } from "./utils/sqlExtractors";

let diagnosticCollection: vscode.DiagnosticCollection;
let decorationType: vscode.TextEditorDecorationType;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  console.log("QRefine activated 🚀");

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
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(document => runAnalysis(document))
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(event => runAnalysis(event.document))
  );

  if (vscode.window.activeTextEditor) {
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

    vscode.workspace.onDidSaveTextDocument((document) => {
    const ext = document.fileName.split(".").pop();

    if (["js", "ts", "py"].includes(ext || "")) {
      const sqlSnippets = sqlExtractors(document);
      const diagnostics: vscode.Diagnostic[] = [];

      for (const snippet of sqlSnippets) {
        const analysis = analyzeSQL({ text: snippet.query });
        for (const result of analysis) {
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
    }
  });

}

function runAnalysis(document: vscode.TextDocument) {
  if (document.languageId !== "sql" && !document.fileName.endsWith(".sql")) return;

  const suggestions = analyzeSQL({ document });

  // Diagnostics
  const diagnostics: vscode.Diagnostic[] = suggestions.map((s: any) => {
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

  // Inline decorations
  const severityIcons: Record<string, string> = { error: "🔴", warning: "⚠️", info: "ℹ️" };
  const severityColors: Record<string, string> = { error: "red", warning: "orange", info: "gray" };

  const editor = vscode.window.visibleTextEditors.find(
    e => e.document.uri.toString() === document.uri.toString()
  );
  if (editor) {
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
  }
}

export function deactivate() {
  if (diagnosticCollection) diagnosticCollection.dispose();
  if (decorationType) decorationType.dispose();
  if (statusBarItem) statusBarItem.dispose();
}

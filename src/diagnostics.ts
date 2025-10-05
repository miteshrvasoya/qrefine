import * as vscode from "vscode";
import { QuerySuggestion } from "./types";

export function provideDiagnostics(uri: vscode.Uri, suggestions: QuerySuggestion[]) {
  const diagnostics: vscode.Diagnostic[] = [];

  suggestions.forEach(s => {
    const severity = s.severity === "error"
      ? vscode.DiagnosticSeverity.Error
      : s.severity === "warning"
      ? vscode.DiagnosticSeverity.Warning
      : vscode.DiagnosticSeverity.Information;

    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(s.line, 0, s.line, 200), // cover whole line
      s.message,
      severity
    );
    diagnostics.push(diagnostic);
  });

  const collection = vscode.languages.createDiagnosticCollection("qrefine");
  collection.set(uri, diagnostics);
}

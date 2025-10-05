import * as vscode from "vscode";
import { QuerySuggestion } from "./types";

const severityIcons = {
  error: "🔴",
  warning: "⚠️",
  info: "ℹ️"
};

export function showInlineSuggestions(
  editor: vscode.TextEditor,
  suggestions: QuerySuggestion[]
) {
  const decorations: vscode.DecorationOptions[] = [];

  suggestions.forEach(s => {
    decorations.push({
      range: new vscode.Range(s.line, editor.document.lineAt(s.line).range.end.character, s.line, editor.document.lineAt(s.line).range.end.character),
      renderOptions: {
        after: {
          contentText: `${severityIcons[s.severity]} ${s.message}`,
          color:
            s.severity === "error"
              ? "red"
              : s.severity === "warning"
              ? "yellow"
              : "gray",
          margin: "0 0 0 2em",
          fontStyle: "italic"
        }
      }
    });
  });

  const decorationType = vscode.window.createTextEditorDecorationType({});
  editor.setDecorations(decorationType, decorations);
}

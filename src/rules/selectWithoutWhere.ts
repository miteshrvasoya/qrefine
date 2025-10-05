import * as vscode from "vscode";
import { SQLRule, RuleSuggestion } from "../types";

export const selectWithoutWhereRule: SQLRule = {
  id: "select-without-where",
  description: "SELECT without WHERE clause",
  apply: (text: string, document: vscode.TextDocument): RuleSuggestion[] => {
    const suggestions: RuleSuggestion[] = [];
    const regex = /\bSELECT\b\s+[^;]+;/gi;
    let match: any;
    while ((match = regex.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      suggestions.push({
        message: "Consider using WHERE clause to limit selected rows.",
        range: new vscode.Range(startPos, endPos),
        severity: "warning",
        code: "select-without-where",
        fix: (query: string) =>
          query.replace(match[0], "SELECT columns FROM table_name WHERE condition_here;")
      });
    }
    return suggestions;
  }
};

import * as vscode from "vscode";
import { SQLRule, RuleSuggestion } from "../types";

export const insertWithoutColumnsRule: SQLRule = {
  id: "insert-without-columns",
  description: "INSERT without explicit column names",
  apply: (text: string, document: vscode.TextDocument): RuleSuggestion[] => {
    const suggestions: RuleSuggestion[] = [];
    const regex = /\bINSERT\s+INTO\s+\w+\s*\([^)]+\)\s*VALUES\s*\([^)]+\)\s*;/gi;
    let match: any;
    while ((match = regex.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      suggestions.push({
        message: "Consider specifying column names in INSERT statements.",
        range: new vscode.Range(startPos, endPos),
        severity: "warning",
        code: "insert-without-columns",
        fix: (query: string) =>
          query.replace(match[0], "INSERT INTO table_name (col1, col2) VALUES (val1, val2);")
      });
    }
    return suggestions;
  }
};

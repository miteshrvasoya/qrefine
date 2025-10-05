import * as vscode from "vscode";
import { SQLRule, RuleSuggestion } from "../types";

export const deleteWithoutWhereRule: SQLRule = {
  id: "delete-without-where",
  description: "DELETE without WHERE clause",
  apply: (text: string, document: vscode.TextDocument): RuleSuggestion[] => {
    const suggestions: RuleSuggestion[] = [];
    const regex = /\bDELETE\s+FROM\s+\w+\s*;/gi;
    let match: any;
    while ((match = regex.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      suggestions.push({
        message: "DELETE without WHERE clause – may delete all rows.",
        range: new vscode.Range(startPos, endPos),
        severity: "error",
        code: "delete-without-where",
        fix: (query: string) =>
          query.replace(match[0], "DELETE FROM table_name WHERE condition_here;")
      });
    }
    return suggestions;
  }
};

import * as vscode from "vscode";
import { SQLRule, RuleSuggestion } from "../types";

export const updateWithoutWhereRule: SQLRule = {
  id: "update-without-where",
  description: "UPDATE without WHERE clause",
  apply: (text: string, document: vscode.TextDocument): RuleSuggestion[] => {
    const suggestions: RuleSuggestion[] = [];
    const regex = /\bUPDATE\s+\w+\s+SET\s+[^;]+;/gi;
    let match: any;
    while ((match = regex.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      suggestions.push({
        message: "UPDATE without WHERE clause – may update all rows.",
        range: new vscode.Range(startPos, endPos),
        severity: "error",
        code: "update-without-where",
        fix: (query: string) =>
          query.replace(match[0], "UPDATE table_name SET column = value WHERE condition_here;")
      });
    }
    return suggestions;
  }
};

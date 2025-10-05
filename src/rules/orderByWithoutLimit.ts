import * as vscode from "vscode";
import { SQLRule, RuleSuggestion } from "../types";

export const orderByWithoutLimitRule: SQLRule = {
  id: "order-by-without-limit",
  description: "ORDER BY without LIMIT clause",
  apply: (text: string, document: vscode.TextDocument): RuleSuggestion[] => {
    const suggestions: RuleSuggestion[] = [];
    const regex = /\bORDER\s+BY\b(?!.*\bLIMIT\b)/gi;
    let match: any;
    while ((match = regex.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      suggestions.push({
        message: "ORDER BY without LIMIT – may fetch large dataset.",
        range: new vscode.Range(startPos, endPos),
        severity: "warning",
        code: "order-by-without-limit",
        fix: (query: string) =>
          query.replace(match[0], "ORDER BY column_name LIMIT n")
      });
    }
    return suggestions;
  }
};

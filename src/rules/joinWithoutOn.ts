import * as vscode from "vscode";
import { SQLRule, RuleSuggestion } from "../types";

export const joinWithoutOnRule: SQLRule = {
  id: "join-without-condition",
  description: "JOIN without ON or USING clause",
  apply: (text: string, document: vscode.TextDocument): RuleSuggestion[] => {
    const suggestions: RuleSuggestion[] = [];
    const regex = /\bJOIN\s+\w+\s*(?!ON|USING)/gi;
    let match: any;
    while ((match = regex.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      suggestions.push({
        message: "JOIN without condition – may cause Cartesian product.",
        range: new vscode.Range(startPos, endPos),
        severity: "error",
        code: "join-without-condition",
        fix: (query: string) =>
          query.replace(match[0], "JOIN table_name ON condition_here")
      });
    }
    return suggestions;
  }
};

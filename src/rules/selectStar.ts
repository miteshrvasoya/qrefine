import * as vscode from "vscode";
import { SQLRule, RuleSuggestion } from "../types";

export const selectStarRule: SQLRule = {
  id: "select-star",
  description: "Avoid SELECT * in queries",
  apply: (text: string, document: vscode.TextDocument): RuleSuggestion[] => {
    const suggestions: RuleSuggestion[] = [];
    const regex = /SELECT\s+\*/gi;
    let match: any;
    while ((match = regex.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      suggestions.push({
        message: "Avoid using SELECT * — specify columns explicitly.",
        range: new vscode.Range(startPos, endPos),
        severity: "warning",
        code: "avoid-select-star",
        fix: (query: string) =>
          query.replace(match[0], "SELECT column1, column2") // placeholder
      });
    }
    return suggestions;
  }
};

import * as vscode from "vscode";
import { SQLRule, RuleSuggestion } from "../types";

export const selectStarRule: SQLRule = {
  id: "select-star",
  description: "Avoid SELECT * in queries",
  apply: (text: string, document?: vscode.TextDocument): RuleSuggestion[] => {
    const suggestions: RuleSuggestion[] = [];
    const regex = /SELECT\s+\*/gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const startIndex = match.index;
      const endIndex = startIndex + match[0].length;

      // If we have a document (e.g. analyzing .sql file)
      let range: vscode.Range;
      if (document) {
        const startPos = document.positionAt(startIndex);
        const endPos = document.positionAt(endIndex);
        range = new vscode.Range(startPos, endPos);
      } else {
        // If no document (e.g. analyzing inline SQL string), just use dummy range
        range = new vscode.Range(new vscode.Position(0, startIndex), new vscode.Position(0, endIndex));
      }

      suggestions.push({
        message: "Avoid using SELECT * — specify columns explicitly.",
        range,
        severity: "warning",
        code: "avoid-select-star",
        fix: (query: string) => query.replace(match![0], "SELECT column1, column2"), // placeholder fix
      });
    }

    return suggestions;
  },
};

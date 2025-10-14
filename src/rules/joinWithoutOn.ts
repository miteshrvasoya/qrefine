import * as vscode from "vscode";
import { SQLRule, RuleSuggestion } from "../types";

export const joinWithoutOnRule: SQLRule = {
  id: "join-without-condition",
  description: "Detects JOIN statements without ON or USING clause",
  apply: (text: string, document?: vscode.TextDocument): RuleSuggestion[] => {
    const suggestions: RuleSuggestion[] = [];

    // Make sure document is provided
    if (!document) {
      console.warn("joinWithoutOnRule: 'document' is undefined.");
      return suggestions;
    }

    // This regex finds JOINs not followed by ON or USING
    const regex = /\bJOIN\s+\w+(\s+\w+)?\s*(?!ON|USING)/gi;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      // capture values to avoid referencing possibly-null 'match' inside the fix closure
      const matchIndex = match.index;
      const matchLength = match[0].length;

      const startPos = document.positionAt(matchIndex);
      const endPos = document.positionAt(matchIndex + matchLength);

      suggestions.push({
        message: "JOIN without ON or USING clause – may cause Cartesian product.",
        range: new vscode.Range(startPos, endPos),
        severity: "error",
        code: "join-without-condition",
        fix: (query: string) =>
          query.slice(0, matchIndex) +
          "JOIN table_name ON condition_here" +
          query.slice(matchIndex + matchLength),
      });
    }

    return suggestions;
  }
};

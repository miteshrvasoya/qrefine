import * as vscode from "vscode";
import { SQLRule, RuleSuggestion } from "../types";

export const selectWithoutWhereRule: SQLRule = {
  id: "select-without-where",
  description: "SELECT without WHERE clause",
  apply: (text: string, document?: vscode.TextDocument): RuleSuggestion[] => {
    const suggestions: RuleSuggestion[] = [];

    if (!document) {
      console.warn("selectWithoutWhereRule: 'document' is undefined.");
      return suggestions;
    }

    // Match SELECT statements and check whether they contain WHERE before the semicolon
    const selectRegex = /\bSELECT\b[\s\S]*?;/gi;

    // use provided document or synthesize positionAt from the plain text
    const doc = document ?? ({
      positionAt: (offset: number) => {
        const before = text.slice(0, offset);
        const line = before.split("\n").length - 1;
        const lastNewline = before.lastIndexOf("\n");
        const character = lastNewline === -1 ? offset : offset - lastNewline - 1;
        return new vscode.Position(line, character);
      },
    } as unknown as vscode.TextDocument);

    let match: RegExpExecArray | null;
    while ((match = selectRegex.exec(text)) !== null) {
      const matchedText = match[0];
      // skip if this SELECT already contains a WHERE before the semicolon (case-insensitive)
      if (/\bWHERE\b/i.test(matchedText)) {
        continue;
      }

      const startPos = doc.positionAt(match.index);
      const endPos = doc.positionAt(match.index + matchedText.length);

      // capture indices so the closure doesn't reference the possibly-null `match`
      const matchIndex = match.index;
      const matchLength = matchedText.length;

      suggestions.push({
        message: "SELECT without WHERE clause – consider filtering rows.",
        range: new vscode.Range(startPos, endPos),
        severity: "warning",
        code: "select-without-where",
        fix: (query: string) =>
          query.slice(0, matchIndex) +
          "SELECT columns FROM table_name WHERE condition_here;" +
          query.slice(matchIndex + matchLength),
      });
    }

    return suggestions;
  }
};

import * as vscode from "vscode";
import { SQLRule, RuleSuggestion } from "../types";

export const likeLeadingPercentRule: SQLRule = {
  id: "like-leading-percent",
  description: "LIKE with leading % prevents index usage",
  apply: (text: string, document: vscode.TextDocument): RuleSuggestion[] => {
    const suggestions: RuleSuggestion[] = [];
    const regex = /\bLIKE\s+'%.*%'/gi;
    let match: any;
    while ((match = regex.exec(text)) !== null) {
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      suggestions.push({
        message: "LIKE with leading % prevents index usage.",
        range: new vscode.Range(startPos, endPos),
        severity: "warning",
        code: "like-leading-percent",
        fix: (query: string) =>
          query.replace(match[0], "LIKE 'value%'")
      });
    }
    return suggestions;
  }
};

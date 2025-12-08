import * as vscode from "vscode";
import { rules } from "./rules"; // existing rule definitions
import { RuleSuggestion } from "./types";
import { tokenize } from "./sqlTokenizer";

interface AnalyzeSQLOptions {
  text?: string;
  document?: vscode.TextDocument | any;
  offset?: number; // used for embedded SQL ranges inside code files
}

/**
 * Analyzes SQL either from a full document or raw SQL string.
 */
export function analyzeSQL(options: AnalyzeSQLOptions): RuleSuggestion[] {
  const { text, document, offset = 0 } = options;
  console.log("analyzeSQL called with options:", text, options);

  const sqlText = text ?? document?.getText();
  console.log("Analyzing SQL:", sqlText);

  if (!sqlText) return [];

  let allSuggestions: RuleSuggestion[] = [];
  const tokens = tokenize(sqlText);

  for (const rule of rules) {
    try {
      // Tokenize once if we haven't already? Or just tokenize here.
      // Ideally we tokenize outside the loop but rules might want text.
      // Let's tokenize once outside.
      // But wait, tokenize is fast enough.
      const suggestions = rule.apply(sqlText, document, tokens);
      console.log(`Rule ${rule.id} found ${suggestions.length} suggestions.`);
      // Adjust range if analyzing embedded SQL (e.g. inside a JS string)
      if (text && !document) {
        for (const s of suggestions) {
          s.range = new vscode.Range(
            new vscode.Position(
              s.range.start.line,
              s.range.start.character + offset
            ),
            new vscode.Position(
              s.range.end.line,
              s.range.end.character + offset
            )
          );
        }
      }
      allSuggestions.push(...suggestions);
    } catch (err) {
      console.error(`Rule failed: ${rule.id}`, err);
    }
  }

  return allSuggestions;
}

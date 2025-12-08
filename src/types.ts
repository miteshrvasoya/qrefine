import * as vscode from 'vscode';

export enum TokenType {
    Keyword,
    Identifier,
    String,
    Operator,
    Comment,
    Number,
    Punctuation,
    Whitespace,
    Unknown
}

export interface Token {
    type: TokenType;
    value: string;
    range: vscode.Range;
    line: number;
    startChar: number;
}

export type RuleSeverity = "info" | "warning" | "error";

export interface QuerySuggestion {
  line: number;
  message: string;
  severity: RuleSeverity;
  range: vscode.Range;
  fix?: {
    title: string;      // Label shown in Quick Fix menu
    replacement: string; // Replacement text
  };
}

export interface RuleSuggestion {
  message: string;
  range: vscode.Range;
  code: string; // unique identifier for quick fix
  severity: RuleSeverity;
  fix?: (text: string) => string; // optional quick fix
}

export interface SQLRule {
  id: string;
  description: string;
  apply: (text: string, document: vscode.TextDocument, tokens?: Token[]) => RuleSuggestion[];
}

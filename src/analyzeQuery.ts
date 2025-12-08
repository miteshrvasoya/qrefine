import * as vscode from "vscode";
import { QuerySuggestion } from "./types";
import { tokenize, TokenType, Token } from "./sqlTokenizer";

export function analyzeQuery(sql: string): QuerySuggestion[] {
  const suggestions: QuerySuggestion[] = [];
  const tokens = tokenize(sql);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    // Rule 1: SELECT *
    if (token.type === TokenType.Keyword && token.value.toLowerCase() === 'select') {
      let j = i + 1;
      // Skip whitespace/comments
      while (j < tokens.length && (tokens[j].type === TokenType.Whitespace || tokens[j].type === TokenType.Comment)) {
        j++;
      }
      if (j < tokens.length && tokens[j].value === '*') {
        suggestions.push({
          line: tokens[j].line,
          message: 'Avoid SELECT * – specify only needed columns.',
          severity: "warning",
          range: tokens[j].range,
          fix: {
             title: "Replace * with explicit column names",
             replacement: "<column1>, <column2>" // Note: Simple replacement, can't easily do full line replacement without more context
          }
        });
      }
    }

    // Rule 2: DELETE/UPDATE without WHERE
    if (token.type === TokenType.Keyword && (token.value.toLowerCase() === 'delete' || token.value.toLowerCase() === 'update')) {
        let hasWhere = false;
        let j = i + 1;
        while (j < tokens.length) {
            if (tokens[j].value.toLowerCase() === 'where') {
                hasWhere = true;
                break;
            }
             if (tokens[j].value === ';') {
                break;
            }
            j++;
        }
        
        if (!hasWhere) {
             suggestions.push({
                line: token.line,
                message: 'This will affect all rows – add a WHERE clause.',
                severity: "error",
                range: token.range,
                fix: {
                    title: "Add WHERE clause",
                    replacement: " WHERE <condition>"
                }
            });
        }
    }

    // Rule 3: JOIN without ON/USING
    if (token.type === TokenType.Keyword && token.value.toLowerCase() === 'join') {
        let hasOn = false;
        let j = i + 1;
        while (j < tokens.length) {
             const t = tokens[j];
             if (t.type === TokenType.Keyword) {
                 if (t.value.toLowerCase() === 'on' || t.value.toLowerCase() === 'using') {
                     hasOn = true;
                     break;
                 }
                 // If we hit another clause like WHERE, GROUP BY, ORDER BY, or another JOIN (unless it's part of the same join chain which is complex, but generally JOIN should be followed by ON before next keyword clause usually)
                 // Actually, simpler logic: scan until next keyword that starts a new clause or semicolon
                 if (['where', 'group', 'order', 'left', 'right', 'inner', 'outer', 'full', 'join', 'limit'].includes(t.value.toLowerCase())) {
                     break;
                 }
             }
             if (t.value === ';') break;
             j++;
        }

        if (!hasOn) {
            suggestions.push({
                line: token.line,
                message: 'JOIN without condition may cause a Cartesian product.',
                severity: "error",
                range: token.range,
                fix: {
                    title: "Add ON clause to JOIN",
                    replacement: " ON <condition>"
                }
            });
        }
    }

     // Rule 4: Functions in WHERE
    if (token.type === TokenType.Keyword && token.value.toLowerCase() === 'where') {
        let j = i + 1;
        while (j < tokens.length && tokens[j].value !== ';') {
             // Heuristic: Identifier followed immediately by '('
             if (tokens[j].type === TokenType.Identifier) {
                 let k = j + 1;
                 // skip whitespace
                  while (k < tokens.length && tokens[k].type === TokenType.Whitespace) k++;
                  if (k < tokens.length && tokens[k].value === '(') {
                       suggestions.push({
                          line: tokens[j].line,
                          message: 'Avoid functions on indexed columns – they prevent index usage.',
                          severity: "warning",
                          range: tokens[j].range
                        });
                  }
             }
             // Stop at next major keyword (approximate)
             if (tokens[j].type === TokenType.Keyword && ['group', 'order', 'limit'].includes(tokens[j].value.toLowerCase())) {
                 break;
             }
             j++;
        }
    }


    // Rule 9: SELECT DISTINCT
    if (token.type === TokenType.Keyword && token.value.toLowerCase() === 'select') {
         let j = i + 1;
         while (j < tokens.length && tokens[j].type === TokenType.Whitespace) j++;
         if (j < tokens.length && tokens[j].value.toLowerCase() === 'distinct') {
              suggestions.push({
                line: tokens[j].line,
                message: 'DISTINCT may hide duplicates – ensure it’s necessary.',
                severity: "info",
                range: tokens[j].range,
                 fix: {
                    title: "Remove DISTINCT",
                    replacement: ""
                  }
              });
         }
    }

  }

  return suggestions;
}

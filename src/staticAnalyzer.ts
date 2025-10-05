import * as vscode from "vscode";
import { QuerySuggestion } from "./types";
import { RuleSuggestion } from "./types";
import { rules } from "./rules";

export interface Suggestion {
  line: number;
  range: vscode.Range;
  message: string;
  severity: "error" | "warning";
  code: string; // unique identifier for quick fix,
  fix?: { title: string; replacement: string }
}


export function analyzeSQLText(document: vscode.TextDocument): RuleSuggestion[] {
  const text = document.getText();
  let allSuggestions: RuleSuggestion[] = [];

  for (const rule of rules) {
    try {
      const suggestions = rule.apply(text, document);
      allSuggestions = allSuggestions.concat(suggestions);
    } catch (err) {
      console.error(`Rule failed: ${rule.id}`, err);
    }
  }

  return allSuggestions;
}


// export function analyzeSQLText(document: vscode.TextDocument): Suggestion[] {
//   const text = document.getText();
//   const suggestions: Suggestion[] = [];
//   const regexes: {
//     pattern: RegExp;
//     message: string;
//     code: string;
//     severity: "error" | "warning";
//     fix: { title: string; replacement: string }
//   }[] = [
//       {
//         pattern: /\bSELECT\s+\*/gi,
//         message: "Avoid SELECT * – specify columns explicitly.",
//         code: "avoid-select-star",
//         severity: "warning",
//         fix: {
//           title: "Replace with explicit columns",
//           replacement: `SELECT columns_here`
//         }
//       },
//       {
//         pattern: /\bJOIN\s+\w+\s*(?!ON|USING)/gi,
//         message: "JOIN without condition – may cause Cartesian product.",
//         code: "join-without-condition",
//         severity: "error",
//         fix: {
//           title: "Add ON or USING clause",
//           replacement: `JOIN table_name ON condition_here`
//         }
//       },
//       {
//         pattern: /\bLIKE\s+'%.*%'/gi,
//         message: "LIKE with leading % prevents index usage.",
//         code: "like-leading-percent",
//         severity: "warning",
//         fix: {
//           title: "Remove leading % if possible",
//           replacement: `LIKE 'value%'`
//         }
//       },
//       {
//         pattern: /\bORDER\s+BY\b(?!.*\bLIMIT\b)/gi,
//         message: "ORDER BY without LIMIT – may fetch large dataset.",
//         code: "order-by-without-limit",
//         severity: "warning",
//         fix: {
//           title: "Add LIMIT clause",
//           replacement: `ORDER BY column_name LIMIT n`
//         }
//       },
//       // New suggestions for DELETE, UPDATE, INSERT, SELECT
//       {
//         pattern: /\bDELETE\s+FROM\s+\w+\s*;/gi,
//         message: "DELETE without WHERE clause – may delete all rows.",
//         code: "delete-without-where",
//         severity: "error",
//         fix: {
//           title: "Add WHERE clause",
//           replacement: `DELETE FROM table_name WHERE condition_here;`
//         }
//       },
//       {
//         pattern: /\bUPDATE\s+\w+\s+SET\s+[^;]+;/gi,
//         message: "UPDATE without WHERE clause – may update all rows.",
//         code: "update-without-where",
//         severity: "error",
//         fix: {
//           title: "Add WHERE clause",
//           replacement: `UPDATE table_name SET column = value WHERE condition_here;`
//         }
//       },
//       {
//         pattern: /\bINSERT\s+INTO\s+\w+\s*\([^)]+\)\s*VALUES\s*\([^)]+\)\s*;/gi,
//         message: "Consider specifying column names in INSERT statements.",
//         code: "insert-without-columns",
//         severity: "warning",
//         fix: {
//           title: "Specify column names",
//           replacement: `INSERT INTO table_name (col1, col2) VALUES (val1, val2);`
//         }
//       },
//       {
//         pattern: /\bSELECT\b\s+[^;]+;/gi,
//         message: "Consider using WHERE clause to limit selected rows.",
//         code: "select-without-where",
//         severity: "warning",
//         fix: {
//           title: "Add WHERE clause",
//           replacement: `SELECT columns FROM table_name WHERE condition_here;`
//         }
//       }
//     ];

//   regexes.forEach(rule => {
//     let match;
//     while ((match = rule.pattern.exec(text)) !== null) {
//       const start = document.positionAt(match.index);
//       const end = document.positionAt(match.index + match[0].length);
//       suggestions.push({
//         line: start.line,
//         range: new vscode.Range(start, end),
//         message: rule.message,
//         severity: rule.severity,
//         code: rule.code,
//         fix: rule.fix
//       });
//     }
//   });

//   return suggestions;
// }
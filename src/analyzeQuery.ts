import * as vscode from "vscode";
import { client } from "./dbClient";
import { parsePlan } from "./planParser";
import { provideDiagnostics } from "./diagnostics";
import { suggestImprovements } from "./suggestions";
import { QuerySuggestion } from "./types";


export function analyzeQuery(sql: string): QuerySuggestion[] {
  const suggestions: QuerySuggestion[] = [];
  const lines = sql.split('\n');

  lines.forEach((line, idx) => {
    const text = line.toLowerCase();
    const range = new vscode.Range(idx, 0, idx, line.length);

    // Rule 1: SELECT *
    if (/select\s+\*/.test(text)) {
      suggestions.push({
      line: idx,
      message: 'Avoid SELECT * – specify only needed columns.',
      severity: "warning",
      range,
      fix: {
        title: "Replace * with explicit column names",
        replacement: line.replace(/\*/g, "<column1>, <column2>")
      }
      });
    }

    // Rule 2: DELETE/UPDATE without WHERE
    if ((/delete\s+from/.test(text) || /update\s+\w+/.test(text)) && !/where/.test(text)) {
      suggestions.push({
      line: idx,
      message: 'This will affect all rows – add a WHERE clause.',
      severity: "error",
      range,
      fix: {
        title: "Add WHERE clause",
        replacement: line.trimEnd() + " WHERE <condition>"
      }
      });
    }

    // Rule 3: JOIN without ON/USING
    if (/join\s+\w+/.test(text) && !/on\s+|using\s*\(/.test(text)) {
      suggestions.push({
      line: idx,
      message: 'JOIN without condition may cause a Cartesian product.',
      severity: "error",
      range,
      fix: {
        title: "Add ON clause to JOIN",
        replacement: line.trimEnd() + " ON <condition>"
      }
      });
    }

    // Rule 4: Functions in WHERE
    if (/where\s+.*\(.*\)/.test(text)) {
      suggestions.push({
      line: idx,
      message: 'Avoid functions on indexed columns – they prevent index usage.',
      severity: "warning",
      range,
      fix: {
        title: "Remove function from WHERE clause",
        replacement: line.replace(/where\s+(.*\(.*\))/, "where <column> = <value>")
      }
      });
    }

    // Rule 5: Multiple OR in WHERE
    if (/where\s+.*or\s+.*or/.test(text)) {
      suggestions.push({
      line: idx,
      message: 'Consider rewriting OR with UNION or use IN for better performance.',
      severity: "info",
      range,
      fix: {
        title: "Rewrite OR with IN",
        replacement: line.replace(/where\s+(.*)\sor\s+(.*)\sor\s+(.*)/, "where <column> IN (<value1>, <value2>, <value3>)")
      }
      });
    }

    // Rule 6: ORDER BY without LIMIT
    if (/order\s+by/.test(text) && !/limit/.test(sql.toLowerCase())) {
      suggestions.push({
      line: idx,
      message: 'ORDER BY without LIMIT may cause unnecessary sorting.',
      severity: "info",
      range,
      fix: {
        title: "Add LIMIT clause",
        replacement: line.trimEnd() + " LIMIT <number>"
      }
      });
    }

    // Rule 7: LIKE with leading wildcard
    if (/like\s+['"]%/.test(text)) {
      suggestions.push({
      line: idx,
      message: 'Leading wildcards prevent index usage – consider full-text search.',
      severity: "warning",
      range,
      fix: {
        title: "Remove leading wildcard",
        replacement: line.replace(/like\s+(['"])%/, "like $1")
      }
      });
    }

    // Rule 8: NOT IN
    if (/not\s+in\s*\(/.test(text)) {
      suggestions.push({
      line: idx,
      message: 'NOT IN can perform poorly – consider using NOT EXISTS.',
      severity: "warning",
      range,
      fix: {
        title: "Rewrite with NOT EXISTS",
        replacement: "-- Rewrite using NOT EXISTS\n-- Example:\n-- WHERE NOT EXISTS (SELECT 1 FROM <table> WHERE <condition>)"
      }
      });
    }

    // Rule 9: SELECT DISTINCT
    if (/select\s+distinct/.test(text)) {
      suggestions.push({
      line: idx,
      message: 'DISTINCT may hide duplicates – ensure it’s necessary.',
      severity: "info",
      range,
      fix: {
        title: "Remove DISTINCT",
        replacement: line.replace(/distinct\s+/i, "")
      }
      });
    }

    // Rule 10: Correlated Subquery
    if (/select\s*\(select/.test(text)) {
      suggestions.push({
      line: idx,
      message: 'Correlated subquery detected – consider JOIN instead.',
      severity: "warning",
      range,
      fix: {
        title: "Rewrite subquery as JOIN",
        replacement: "-- Rewrite correlated subquery as JOIN"
      }
      });
    }
  });

  return suggestions;
}



// export async function analyzeQuery(sql: string) {
//   const editor = vscode.window.activeTextEditor;
//   if (!editor) {
//     vscode.window.showErrorMessage("No active SQL editor.");
//     return;
//   }

//   const selection = editor.selection;
//   const query = selection.isEmpty
//     ? editor.document.getText()
//     : editor.document.getText(selection);

//   if (!query.trim()) {
//     vscode.window.showWarningMessage("No SQL query selected.");
//     return;
//   }

//   if (!client) {
//     vscode.window.showErrorMessage("Not connected to database. Run QRefine: Connect to Database first.");
//     return;
//   }

//   try {
//     const res = await client.query(`EXPLAIN (FORMAT JSON) ${query}`);
//     const planJson = res.rows[0]["QUERY PLAN"][0];

//     // Parse plan
//     const parsed = parsePlan(planJson);

//     // Get suggestions
//     const suggestions = suggestImprovements(parsed);

//     // Show diagnostics
//     provideDiagnostics(editor.document.uri, suggestions);

//     // Also log to Output channel
//     const output = vscode.window.createOutputChannel("QRefine Suggestions");
//     output.clear();
//     output.appendLine("=== QRefine Suggestions ===");
//     suggestions.forEach((s, i) => {
//       output.appendLine(`${i + 1}. ${s.message}`);
//     });
//     output.show();

//     vscode.window.showInformationMessage("QRefine analysis complete!");
//   } catch (err: any) {
//     vscode.window.showErrorMessage(`Failed to analyze query: ${err.message}`);
//   }
// }

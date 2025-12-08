import * as vscode from 'vscode';
import { Token, TokenType } from './types';

export { Token, TokenType }; // Re-export for convenience if needed, or just remove

const KEYWORDS = new Set([
    'select', 'from', 'where', 'insert', 'update', 'delete', 'join', 'left', 'right', 'inner', 'outer', 'full', 'cross',
    'on', 'using', 'group', 'by', 'order', 'having', 'limit', 'offset', 'union', 'all', 'distinct', 'as', 'and', 'or',
    'not', 'in', 'exists', 'null', 'is', 'like', 'between', 'case', 'when', 'then', 'else', 'end', 'create', 'table',
    'drop', 'alter', 'index', 'view'
]);

export function tokenize(sql: string): Token[] {
    const tokens: Token[] = [];
    let current = 0;
    let line = 0;
    let char = 0;

    while (current < sql.length) {
        let start = current;
        let startLine = line;
        let startChar = char;
        const c = sql[current];

        // Whitespace
        if (/\s/.test(c)) {
            if (c === '\n') {
                line++;
                char = 0;
            } else {
                char++;
            }
            current++;
            continue;
        }

        // Comment --
        if (c === '-' && sql[current + 1] === '-') {
            while (current < sql.length && sql[current] !== '\n') {
                current++;
                char++; // Rough char count, accurate for consuming
            }
            // End of line, will handle newline in next iteration or EOF
            continue;
        }

        // Comment /* */
        if (c === '/' && sql[current + 1] === '*') {
            current += 2;
            char += 2;
            while (current < sql.length && !(sql[current] === '*' && sql[current + 1] === '/')) {
                if (sql[current] === '\n') {
                    line++;
                    char = 0;
                } else {
                    char++;
                }
                current++;
            }
            if (current < sql.length) {
                current += 2; // consume */
                char += 2;
            }
            continue;
        }

        // Strings ' or "
        if (c === "'" || c === '"') {
            const quote = c;
            current++;
            char++;
            let value = quote;
            while (current < sql.length) {
                const charInStr = sql[current];
                value += charInStr;
                if (charInStr === quote) { // simplistic, doesn't handle escaping yet for simplicity as per requirements
                     current++;
                     char++;
                     break;
                }
                if (charInStr === '\n') {
                    line++;
                    char = 0;
                } else {
                    char++;
                }
                current++;
            }
            tokens.push({
                type: TokenType.String,
                value,
                range: new vscode.Range(startLine, startChar, line, char),
                line: startLine,
                startChar
            });
            continue;
        }

        // Numbers
        if (/[0-9]/.test(c)) {
            let value = "";
            while (current < sql.length && /[0-9.]/.test(sql[current])) {
                 value += sql[current];
                 current++;
                 char++;
            }
            tokens.push({
                type: TokenType.Number,
                value,
                range: new vscode.Range(startLine, startChar, line, char),
                line: startLine,
                startChar
            });
            continue;
        }

        // Operators & Punctuation
        if (/[(),;.*=<>!+\-]/.test(c)) {
             tokens.push({
                type: (c === ';' || c === ',' || c === ')') ? TokenType.Punctuation : TokenType.Operator,
                value: c,
                range: new vscode.Range(startLine, startChar, line, char + 1),
                line: startLine,
                startChar
            });
            current++;
            char++;
            continue;
        }

        // Identifiers & Keywords
        if (/[a-zA-Z_]/.test(c)) {
            let value = "";
            while (current < sql.length && /[a-zA-Z0-9_]/.test(sql[current])) {
                value += sql[current];
                current++;
                char++;
            }
            const type = KEYWORDS.has(value.toLowerCase()) ? TokenType.Keyword : TokenType.Identifier;
            tokens.push({
                type,
                value, // Keep original case for value
                range: new vscode.Range(startLine, startChar, line, char),
                line: startLine,
                startChar
            });
            continue;
        }

        // Unknown
        current++;
        char++;
    }

    return tokens;
}

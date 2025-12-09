import * as assert from 'assert';
import * as vscode from 'vscode';
import { sqlExtractors } from '../utils/sqlExtractors';

suite('SQL Extractors Test Suite', () => {

    // Mock document helper
    function createMockDocument(content: string, languageId: string): vscode.TextDocument {
        return {
            getText: () => content,
            languageId,
            positionAt: (offset: number) => new vscode.Position(0, offset), // Simplified for testing count/content
            fileName: `test.${languageId === 'python' ? 'py' : languageId}`,
            uri: vscode.Uri.file(`test.${languageId === 'python' ? 'py' : languageId}`),
            version: 1,
            isDirty: false,
            isUntitled: false,
            isClosed: false,
            save: async () => true,
            eol: vscode.EndOfLine.LF,
            lineCount: 1,
            lineAt: (line: number) => ({ lineNumber: line, text: content, range: new vscode.Range(0, 0, 0, content.length), isEmptyOrWhitespace: false, firstNonWhitespaceCharacterIndex: 0 } as vscode.TextLine),
            offsetAt: (position: vscode.Position) => 0,
            getWordRangeAtPosition: (position: vscode.Position) => undefined,
            validateRange: (range: vscode.Range) => range,
        } as unknown as vscode.TextDocument;
    }

    test('Should extract SQL from Python triple quotes', () => {
        const pythonCode = `
def get_users():
    query = """SELECT * FROM users WHERE active = 1"""
    return run(query)
        `;
        const doc = createMockDocument(pythonCode, 'python');
        const snippets = sqlExtractors(doc, 'python');
        
        assert.ok(snippets.length > 0, 'No snippets found in Python code');
        assert.ok(snippets.some(s => s.query.includes('SELECT * FROM users')), 'Failed to extract triple quoted SQL');
    });

    test('Should extract SQL from Go backticks', () => {
        const goCode = `
func getUsers() {
    query := \`SELECT * FROM users WHERE active = 1\`
    db.Query(query)
}
        `;
        const doc = createMockDocument(goCode, 'go');
        const snippets = sqlExtractors(doc, 'go');

        assert.ok(snippets.length > 0, 'No snippets found in Go code');
        assert.ok(snippets.some(s => s.query.includes('SELECT * FROM users')), 'Failed to extract backtick SQL');
    });

    test('Should still extract normal SQL statements', () => {
         const jsCode = `const q = "SELECTid FROM users";`; // intentional typo to check validation logic? No, let's use valid sql
         const jsCodeValid = `const q = "SELECT * FROM users";`;
         const doc = createMockDocument(jsCodeValid, 'javascript');
         const snippets = sqlExtractors(doc, 'javascript');
         assert.ok(snippets.length > 0);
    });
});

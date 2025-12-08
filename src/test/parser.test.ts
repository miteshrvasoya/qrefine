import * as assert from 'assert';
import * as vscode from 'vscode';
import { analyzeQuery } from '../analyzeQuery';

suite('SQL Parser Test Suite', () => {

    test('Should detect SELECT *', () => {
        const sql = 'SELECT * FROM users';
        const suggestions = analyzeQuery(sql);
        assert.ok(suggestions.some(s => s.message.includes('Avoid SELECT *')), 'Did not detect SELECT *');
    });

    test('Should detect JOIN without ON (Single Line)', () => {
        const sql = 'SELECT * FROM t1 JOIN t2';
        const suggestions = analyzeQuery(sql);
        assert.ok(suggestions.some(s => s.message.includes('JOIN without condition')), 'Did not detect missing ON in single line');
    });

    test('Should NOT report error for valid multi-line JOIN', () => {
        const sql = `
            SELECT a.id, b.name
            FROM authors a
            JOIN books b
            ON a.id = b.author_id
            WHERE b.price > 10
        `;
        const suggestions = analyzeQuery(sql);
        const joinError = suggestions.find(s => s.message.includes('JOIN without condition'));
        assert.strictEqual(joinError, undefined, 'False positive: Reported missing ON for valid multi-line JOIN');
    });

    test('Should detect missing ON in multi-line JOIN', () => {
        const sql = `
            SELECT a.id, b.name
            FROM authors a
            JOIN books b
            WHERE b.price > 10
        `;
        const suggestions = analyzeQuery(sql);
        assert.ok(suggestions.some(s => s.message.includes('JOIN without condition')), 'Failed to detect missing ON in multi-line JOIN');
    });

    test('Should detect unsafe DELETE', () => {
        const sql = 'DELETE FROM users;';
        const suggestions = analyzeQuery(sql);
        assert.ok(suggestions.some(s => s.message.includes('affect all rows')), 'Did not detect unsafe DELETE');
    });

     test('Should propertly ignore comments', () => {
        const sql = `
            SELECT * FROM t1 -- This is a comment check
            JOIN t2 ON t1.id = t2.id
        `;
        const suggestions = analyzeQuery(sql);
        // Should catch SELECT *
        assert.ok(suggestions.some(s => s.message.includes('Avoid SELECT *')));
        // Should NOT catch JOIN error because ON is present
        const joinError = suggestions.find(s => s.message.includes('JOIN without condition'));
        assert.strictEqual(joinError, undefined, 'False positive due to comments?');
    });
});

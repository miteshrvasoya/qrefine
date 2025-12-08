import * as assert from 'assert';
import * as vscode from 'vscode';
import { joinWithoutOnRule } from '../rules/joinWithoutOn';

suite('Rule Tests: Join Without ON', () => {

    test('Should detect JOIN without ON (Single Line)', () => {
        const sql = 'SELECT * FROM t1 JOIN t2';
        const suggestions = joinWithoutOnRule.apply(sql, undefined as any);
        assert.ok(suggestions.some(s => s.message.includes('JOIN without')), 'Did not detect missing ON');
    });

    test('Should NOT report error for valid multi-line JOIN', () => {
        const sql = `
            SELECT a.id, b.name
            FROM authors a
            JOIN books b
            ON a.id = b.author_id
            WHERE b.price > 10
        `;
        const suggestions = joinWithoutOnRule.apply(sql, undefined as any);
        const joinError = suggestions.find(s => s.message.includes('JOIN without'));
        assert.strictEqual(joinError, undefined, 'False positive: Reported missing ON for valid multi-line JOIN');
    });

    test('Should detect missing ON in multi-line JOIN', () => {
        const sql = `
            SELECT a.id, b.name
            FROM authors a
            JOIN books b
            WHERE b.price > 10
        `;
        const suggestions = joinWithoutOnRule.apply(sql, undefined as any);
        assert.ok(suggestions.some(s => s.message.includes('JOIN without')), 'Failed to detect missing ON in multi-line JOIN');
    });

    test('Should ignore comments', () => {
        const sql = `
            SELECT * FROM t1 -- comment
            JOIN t2 -- comment
            ON t1.id = t2.id
        `;
        const suggestions = joinWithoutOnRule.apply(sql, undefined as any);
        const joinError = suggestions.find(s => s.message.includes('JOIN without'));
        assert.strictEqual(joinError, undefined, 'False positive due to comments');
    });

    test('Should ignore NATURAL JOIN', () => {
        const sql = 'SELECT * FROM t1 NATURAL JOIN t2';
        const suggestions = joinWithoutOnRule.apply(sql, undefined as any);
        assert.strictEqual(suggestions.length, 0, 'False positive for NATURAL JOIN');
    });
    
    test('Should ignore CROSS JOIN', () => {
        const sql = 'SELECT * FROM t1 CROSS JOIN t2';
        const suggestions = joinWithoutOnRule.apply(sql, undefined as any);
        assert.strictEqual(suggestions.length, 0, 'False positive for CROSS JOIN');
    });
});

import * as vscode from "vscode";

export function sqlExtractors(document: vscode.TextDocument) {
    // Placeholder function to represent SQL extractors module
    const text = document.getText();

    const sqlRegex = /(["'`])\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH)\b[\s\S]*?\1/gi;

    const sqlQueries: { query: string; range: vscode.Range }[] = [];
    let match: RegExpExecArray | null;

    while ((match = sqlRegex.exec(text)) !== null) {
        const rawQuery = match[0];
        const keyword = match[2];
        const startIndex = match.index;
        const endIndex = startIndex + rawQuery.length;

        // Heuristic filters: avoid false positives
        if (
            rawQuery.split(/\s+/).length > 3 && // more than 3 words
            /(FROM|WHERE|VALUES|SET|INTO|JOIN)/i.test(rawQuery) // must contain at least one common SQL keyword
        ) {
            const startPos = document.positionAt(startIndex);
            const endPos = document.positionAt(endIndex);
            sqlQueries.push({
                query: rawQuery.replace(/^["'`]|["'`]$/g, ""), // remove surrounding quotes
                range: new vscode.Range(startPos, endPos),
            });
        }
    }

    return sqlQueries;
}
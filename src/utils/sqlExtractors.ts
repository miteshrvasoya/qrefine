import * as vscode from "vscode";

export function sqlExtractors(document: vscode.TextDocument) {
	const text = document.getText();

	// First, find all string-like segments (", ', `) in the document.
	// Then, inside each string, look for strong SQL patterns such as:
	//  - SELECT ... FROM
	//  - INSERT ... INTO
	//  - UPDATE ... SET
	//  - DELETE ... FROM
	//  - WITH ... SELECT
	// This two-stage approach significantly reduces false positives like
	// import paths (e.g. 'lodash') or generic text constants.
	const stringRegex = /(["'`])([\s\S]*?)\1/g;

	const sqlStructurePatterns: RegExp[] = [
		/\bSELECT\b[\s\S]+?\bFROM\b/i,
		/\bINSERT\b[\s\S]+?\bINTO\b/i,
		/\bUPDATE\b[\s\S]+?\bSET\b/i,
		/\bDELETE\b[\s\S]+?\bFROM\b/i,
		/\bWITH\b[\s\S]+?\bSELECT\b/i,
	];

	const sqlQueries: { query: string; range: vscode.Range }[] = [];
	let match: RegExpExecArray | null;

	while ((match = stringRegex.exec(text)) !== null) {
		const fullMatch = match[0];
		const content = match[2]; // inside the quotes/backticks
		const startIndex = match.index;
		const endIndex = startIndex + fullMatch.length;

		// Quick length/word-count filter to skip tiny strings like 'id', 'lodash', etc.
		const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
		if (wordCount < 4) {
			continue;
		}

		// Check if the content matches any strong SQL structure.
		const isSqlLike = sqlStructurePatterns.some((pattern) => pattern.test(content));
		if (!isSqlLike) {
			continue;
		}

		const startPos = document.positionAt(startIndex);
		const endPos = document.positionAt(endIndex);
		sqlQueries.push({
			query: content,
			range: new vscode.Range(startPos, endPos),
		});
	}

	return sqlQueries;
}
import * as vscode from "vscode";

interface SQLQuery {
	query: string;
	range: vscode.Range;
	type: "complete" | "template" | "dynamic";
	isValid: boolean;
	confidence: number; // 0-100
}

/**
 * Advanced SQL Query Extractor
 * Extracts SQL queries from TypeScript/JavaScript code files
 * Handles:
 * - Complete SQL strings
 * - Template literals with ${} interpolation
 * - String concatenation
 * - Detects dynamic queries that need runtime interception
 */
export function sqlExtractors(document: vscode.TextDocument, languageId?: string): SQLQuery[] {
	const text = document.getText();
	const sqlQueries: SQLQuery[] = [];

	// Extract template literals
	const templateLiterals = extractTemplateLiterals(text, document);
	console.log("Template literals found:", templateLiterals.length);
	sqlQueries.push(...templateLiterals);

	// Extract quoted strings (single and double quotes)
	const quotedStrings = extractQuotedStrings(text, document);
	console.log("Quoted strings found:", quotedStrings.length);
	sqlQueries.push(...quotedStrings);

	// Language specific extractions
	if (languageId === 'python' || languageId === 'py') {
		const pythonStrings = extractPythonStringLiterals(text, document);
		console.log("Python strings found:", pythonStrings.length);
		sqlQueries.push(...pythonStrings);
	}

	if (languageId === 'go') {
		const goStrings = extractGoRawStrings(text, document);
		console.log("Go strings found:", goStrings.length);
		sqlQueries.push(...goStrings);
	}

	// Extract concatenated strings (generic)
	const concatenatedStrings = extractConcatenatedStrings(text, document);
	console.log("Concatenated strings found:", concatenatedStrings.length);
	sqlQueries.push(...concatenatedStrings);

	// Remove duplicates and sort by position
	const result = deduplicateQueries(sqlQueries).sort(
		(a, b) => a.range.start.line - b.range.start.line
	);
	console.log("Total SQL queries extracted:", result.length);
	return result;
}

/**
 * Extract SQL from template literals (backticks)
 * Handles ${...} interpolation by replacing with placeholders
 */
function extractTemplateLiterals(
	text: string,
	document: vscode.TextDocument
): SQLQuery[] {
	const queries: SQLQuery[] = [];
	const templateRegex = /`([^`]*(?:\$\{[^}]*\}[^`]*)*)`/g;
	let match: RegExpExecArray | null;

	while ((match = templateRegex.exec(text)) !== null) {
		const fullMatch = match[0];
		let content = match[1];
		const startIndex = match.index;
		const endIndex = startIndex + fullMatch.length;

		console.log("Template literal found:", fullMatch);

		// Replace ${...} with placeholders
		const originalContent = content;
		content = content.replace(/\$\{[^}]*\}/g, "?");

		console.log("After placeholder replacement:", content);

		// Validate if it's SQL
		const validation = validateSQL(content);
		console.log("Validation result:", validation);

		if (!validation.isValid || validation.confidence < 30) {
			console.log("Skipped due to validation failure");
			continue;
		}

		const startPos = document.positionAt(startIndex);
		const endPos = document.positionAt(endIndex);

		queries.push({
			query: content, // with placeholders
			range: new vscode.Range(startPos, endPos),
			type: "template",
			isValid: validation.isValid,
			confidence: validation.confidence,
		});
	}

	return queries;
}

/**
 * Extract SQL from quoted strings (single and double quotes)
 * Does NOT handle concatenation within quotes
 */
function extractQuotedStrings(
	text: string,
	document: vscode.TextDocument
): SQLQuery[] {
	const queries: SQLQuery[] = [];
	const quoteRegex = /(['"`])((?:(?=(\\?))\3[\s\S]|(?!\1).)*?)\1/g;
	let match: RegExpExecArray | null;

	while ((match = quoteRegex.exec(text)) !== null) {
		const fullMatch = match[0];
		const content = match[2]; // content between quotes
		const quote = match[1];
		const startIndex = match.index;
		const endIndex = startIndex + fullMatch.length;

		console.log("Quoted string found:", fullMatch);

		// Skip very small strings (performance optimization)
		const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

		console.log("Word count:", wordCount);
		if (wordCount < 4) {
			console.log("Skipped: too few words");
			continue;
		}

		// Skip single quotes (usually variable names, etc)
		if (quote === "'") {
			console.log("Skipped: single quote");
			continue;
		}

		const validation = validateSQL(content);
		console.log("Validation result:", validation);
		if (!validation.isValid || validation.confidence < 40) {
			console.log("Skipped due to validation failure");
			continue;
		}

		const startPos = document.positionAt(startIndex);
		const endPos = document.positionAt(endIndex);

		queries.push({
			query: content,
			range: new vscode.Range(startPos, endPos),
			type: "complete",
			isValid: validation.isValid,
			confidence: validation.confidence,
		});
	}

	return queries;
}

/**
 * Extract concatenated SQL strings
 * Detects patterns like: `"SELECT col FROM " + table + " WHERE id = " + id`
 * Returns placeholder version since actual query is dynamic
 */
function extractConcatenatedStrings(
	text: string,
	document: vscode.TextDocument
): SQLQuery[] {
	const queries: SQLQuery[] = [];

	// Pattern: string concatenation with + operators
	const concatRegex =
		/([""`][^""`]*[""`]\s*\+\s*)+[""`][^""`]*[""`]/g;
	let match: RegExpExecArray | null;

	while ((match = concatRegex.exec(text)) !== null) {
		const fullMatch = match[0];
		const startIndex = match.index;
		const endIndex = startIndex + fullMatch.length;

		// Extract all string parts
		const stringParts = extractStringParts(fullMatch);
		if (stringParts.length < 3) {
			continue; // Not a meaningful concatenation
		}

		// Join parts to get a representation
		const representation = stringParts.join(" ");

		// Check if it looks like SQL
		const validation = validateSQL(representation);
		if (!validation.isValid || validation.confidence < 30) {
			continue;
		}

		const startPos = document.positionAt(startIndex);
		const endPos = document.positionAt(endIndex);

		queries.push({
			query: representation,
			range: new vscode.Range(startPos, endPos),
			type: "dynamic",
			isValid: false, // Dynamic queries are not fully analyzable
			confidence: validation.confidence,
		});
	}

	return queries;
}

/**
 * Extract Python triple-quoted strings (""" or ''')
 */
function extractPythonStringLiterals(
	text: string,
	document: vscode.TextDocument
): SQLQuery[] {
	const queries: SQLQuery[] = [];
	// Regex for triple quotes. Note: simplistic, doesn't handle escaping well inside
	const tripleRegex = /("""|''')([\s\S]*?)\1/g;
	let match: RegExpExecArray | null;

	while ((match = tripleRegex.exec(text)) !== null) {
		const fullMatch = match[0];
		const content = match[2];
		const startIndex = match.index;
		const endIndex = startIndex + fullMatch.length;

		const validation = validateSQL(content);
		if (!validation.isValid || validation.confidence < 30) {
			continue;
		}

		const startPos = document.positionAt(startIndex);
		const endPos = document.positionAt(endIndex);

		queries.push({
			query: content,
			range: new vscode.Range(startPos, endPos),
			type: "complete",
			isValid: validation.isValid,
			confidence: validation.confidence,
		});
	}
	return queries;
}

/**
 * Extract Go raw strings (backticks)
 * Go backticks do not support interpolation, so we treat them as complete strings.
 */
function extractGoRawStrings(
	text: string,
	document: vscode.TextDocument
): SQLQuery[] {
	const queries: SQLQuery[] = [];
	// Backticks in Go
	const backtickRegex = /`([^`]*)`/g;
	let match: RegExpExecArray | null;

	while ((match = backtickRegex.exec(text)) !== null) {
		const fullMatch = match[0];
		const content = match[1];
		const startIndex = match.index;
		const endIndex = startIndex + fullMatch.length;

		const validation = validateSQL(content);
		if (!validation.isValid || validation.confidence < 30) {
			continue;
		}

		const startPos = document.positionAt(startIndex);
		const endPos = document.positionAt(endIndex);

		queries.push({
			query: content,
			range: new vscode.Range(startPos, endPos),
			type: "complete",
			isValid: validation.isValid,
			confidence: validation.confidence,
		});
	}
	return queries;
}

/**
 * Validate if a string is likely SQL
 * Returns { isValid: boolean, confidence: 0-100 }
 */
function validateSQL(content: string): {
	isValid: boolean;
	confidence: number;
} {
	if (!content || content.trim().length === 0) {
		return { isValid: false, confidence: 0 };
	}

	const trimmed = content.trim().toUpperCase();

	// SQL keywords that indicate valid SQL
	const sqlKeywords = [
		"SELECT",
		"INSERT",
		"UPDATE",
		"DELETE",
		"WITH",
		"CREATE",
		"ALTER",
		"DROP",
		"TRUNCATE",
	];

	// Check for SQL structure
	const startsWithKeyword = sqlKeywords.some((kw) => trimmed.startsWith(kw));
	if (!startsWithKeyword) {
		return { isValid: false, confidence: 0 };
	}

	let confidence = 50; // Base confidence for matching keyword

	// Check for complete SQL structure
	const hasFromClause =
		/\bFROM\b/i.test(content) &&
		(/\bSELECT\b/i.test(content) ||
			/\bWITH\b/i.test(content));
	if (hasFromClause) confidence += 30;

	const hasIntoClause =
		/\bINSERT\b/i.test(content) && /\bINTO\b/i.test(content);
	if (hasIntoClause) confidence += 30;

	const hasSetClause =
		/\bUPDATE\b/i.test(content) && /\bSET\b/i.test(content);
	if (hasSetClause) confidence += 30;

	// Check for common SQL patterns
	if (/\bWHERE\b/i.test(content)) confidence += 10;
	if (/\bJOIN\b/i.test(content)) confidence += 10;
	if (/\bORDER\s+BY\b/i.test(content)) confidence += 5;
	if (/\bGROUP\s+BY\b/i.test(content)) confidence += 5;

	// Check for suspicious patterns that indicate non-SQL
	if (/import\b/i.test(content) || /require\b/i.test(content)) {
		confidence -= 50;
	}
	if (/^http/i.test(content)) {
		confidence -= 50;
	}

	confidence = Math.min(100, Math.max(0, confidence));

	return {
		isValid: confidence > 30,
		confidence,
	};
}

/**
 * Extract string parts from concatenation
 * Handles patterns like: "SELECT col FROM " + table + " WHERE id = "
 */
function extractStringParts(concatenation: string): string[] {
	const parts: string[] = [];
	const partRegex = /[""`]([^"`"]*?)[""`]/g;
	let match: RegExpExecArray | null;

	while ((match = partRegex.exec(concatenation)) !== null) {
		parts.push(match[1]);
	}

	return parts;
}

/**
 * Remove duplicate queries (same content in different locations)
 */
function deduplicateQueries(queries: SQLQuery[]): SQLQuery[] {
	const seen = new Set<string>();
	return queries.filter((q) => {
		const key = q.query.trim().toUpperCase();
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}
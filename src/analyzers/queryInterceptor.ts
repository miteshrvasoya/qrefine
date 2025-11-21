/**
 * Runtime Query Interceptor for QRefine
 * Captures SQL queries executed at runtime via function hooks
 * Useful for dynamic queries that can't be statically analyzed
 */

import * as vscode from "vscode";

export interface CapturedQuery {
	query: string;
	timestamp: number;
	source: string; // function name that executed it
	userInfo?: { user_id: number; username: string };
}

export class QueryInterceptor {
	private static capturedQueries: CapturedQuery[] = [];
	private static maxQueriesStored = 100;

	/**
	 * Capture a query executed at runtime
	 * Can be called from backend API middleware
	 */
	static captureQuery(
		query: string,
		source: string = "unknown",
		userInfo?: { user_id: number; username: string }
	): void {
		const captured: CapturedQuery = {
			query: query.trim(),
			timestamp: Date.now(),
			source,
			userInfo,
		};

		this.capturedQueries.unshift(captured); // Add to front

		// Keep only recent queries
		if (this.capturedQueries.length > this.maxQueriesStored) {
			this.capturedQueries.pop();
		}

		console.log(`[QRefine] Captured query from ${source}: ${query.substring(0, 50)}...`);
	}

	/**
	 * Get all captured queries
	 */
	static getCapturedQueries(): CapturedQuery[] {
		return this.capturedQueries;
	}

	/**
	 * Get recent captured queries (last N)
	 */
	static getRecentQueries(limit: number = 10): CapturedQuery[] {
		return this.capturedQueries.slice(0, limit);
	}

	/**
	 * Clear captured queries
	 */
	static clearQueries(): void {
		this.capturedQueries = [];
	}

	/**
	 * Send captured query to backend for analysis
	 * Can be integrated into extension API calls
	 */
	static async sendForAnalysis(
		query: string,
		authToken: string | null,
		userId: number | null
	): Promise<any> {
		try {
			const headers: any = {
				"Content-Type": "application/json",
			};

			if (authToken) {
				headers["Authorization"] = `Bearer ${authToken}`;
			}

			const body: any = {
				query,
			};

			if (userId) {
				body.user_id = userId;
			}

			const response = await fetch("http://127.0.0.1:8000/analysis", {
				method: "POST",
				headers,
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				throw new Error(`Analysis failed with status ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			console.error("Failed to send query for analysis:", error);
			throw error;
		}
	}
}

/**
 * Decorator for intercepting method calls
 * Usage: @InterceptQuery("methodName")
 * Captures queries passed to decorated async methods
 */
export function InterceptQuery(methodName: string) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value;

		descriptor.value = async function (...args: any[]) {
			// Assume first argument might be query
			const query = args[0];
			if (typeof query === "string" && query.length > 10) {
				QueryInterceptor.captureQuery(query, methodName || propertyKey);
			}

			return originalMethod.apply(this, args);
		};

		return descriptor;
	};
}

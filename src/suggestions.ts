// Dummy rule-based suggestions
export function suggestImprovements(plan: any): { message: string; severity: "warning" | "error" }[] {
  const suggestions: { message: string; severity: "warning" | "error" }[] = [];

  if (!plan) return suggestions;

  // Rule 1: Sequential Scan detected
  if (plan["Node Type"] && plan["Node Type"] === "Seq Scan") {
    suggestions.push({
      message: "Sequential Scan detected — consider adding an index on the filter column.",
      severity: "warning"
    });
  }

  // Rule 2: SELECT * usage (basic check)
  if (plan.Output && plan.Output.some((col: string) => col === "*")) {
    suggestions.push({
      message: "Avoid SELECT * — only select required columns.",
      severity: "warning"
    });
  }

  // Rule 3: High estimated cost
  if (plan["Total Cost"] && plan["Total Cost"] > 100000) {
    suggestions.push({
      message: `High estimated cost (${plan["Total Cost"]}). Consider optimizing joins or adding indexes.`,
      severity: "warning"
    });
  }

  return suggestions;
}

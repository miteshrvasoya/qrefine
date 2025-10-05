// Simplified parser for Postgres EXPLAIN JSON
export function parsePlan(planJson: any): any {
  try {
    // planJson is usually { "Plan": { ... } }
    return planJson.Plan || planJson;
  } catch {
    return {};
  }
}

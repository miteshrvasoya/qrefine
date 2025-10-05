import * as vscode from "vscode";
import { Client } from "pg";

export let client: Client | null = null;

export async function connectToDb() {
  const config = vscode.workspace.getConfiguration("qrefine");

  client = new Client({
    host: config.get("db.host"),
    port: config.get("db.port"),
    user: config.get("db.user"),
    password: config.get("db.password"),
    database: config.get("db.database")
  });

  await client.connect();
}

// Alias for compatibility with old import
export { connectToDb as connectDB };

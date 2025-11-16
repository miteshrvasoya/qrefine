import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AuthAPI } from '../auth/api';

export class QueryPlanWebview {
  private panel: vscode.WebviewPanel | null = null;
  private extensionUri: vscode.Uri;
  private authAPI: AuthAPI;

  constructor(extensionUri: vscode.Uri, authAPI?: AuthAPI) {
    this.extensionUri = extensionUri;
    this.authAPI = authAPI || new AuthAPI(null as any); // fallback if not provided
  }

  /**
   * Opens or reveals the webview panel for query plan visualization.
   */
  public show(queryText: string) {

    console.log("Query WebView is opening for:", queryText);  

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'qrefineQueryPlan',
        'QRefine Query Plan Visualizer',
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      this.panel.webview.html = this.getHtml(this.panel.webview);
      this.panel.onDidDispose(() => (this.panel = null));
    }

    // Send query text to backend and show loading spinner
    this.panel.webview.postMessage({ type: 'loading', query: queryText });

    console.log("Fetching query plan for:", queryText);

    this.fetchQueryPlan(queryText);
  }

  /**
   * Fetch query plan from backend with authentication
   */
  private async fetchQueryPlan(query: string) {
    try {
      const response = await this.authAPI.request('http://localhost:8000/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query,
          explain_only: false 
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      console.log("Received query plan response:", result);

      // Send the result to webview
      this.panel?.webview.postMessage({
        type: 'analyzeResponse',
        payload: result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to fetch query plan: ${errorMessage}`);
      console.error("Error fetching query plan:", error);
      this.panel?.webview.postMessage({
        type: 'error',
        message: 'Unable to connect to analysis backend.',
      });
    }
  }

  /**
   * Load the prebuilt HTML content
   */
  private getHtml(webview: vscode.Webview): string {
    console.log("Loading HTML for Query Plan Webview");
    
    try {
      const filePath = path.join(
        this.extensionUri.fsPath,
        'media',
        'qrefine-plan.html'
      );
      
      let html = fs.readFileSync(filePath, 'utf8');
      
      console.log("HTML content loaded for Query Plan Webview");

      // Optionally inject base URI if needed
      const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this.extensionUri, 'media', 'qrefine-plan.html')
      );
      html = html.replace(/__BASE_URI__/g, scriptUri.toString());

      return html;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Error loading HTML for Query Plan Webview:", errorMessage);
      vscode.window.showErrorMessage(`Failed to load webview HTML: ${errorMessage}`);
      
      // Return a fallback HTML
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>QRefine Plan Visualizer</title>
</head>
<body>
  <h1>Error loading webview</h1>
  <p>${errorMessage}</p>
</body>
</html>`;
    }
  }
}

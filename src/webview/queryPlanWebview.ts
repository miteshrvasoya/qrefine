import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { AuthAPI } from '../auth/api';
import { EnvironmentConfig } from '../config/environment';

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
   * If an initialResult is provided, it will be rendered directly without
   * issuing a new HTTP request to the backend. This is used when the
   * analysis result is pushed from the server (e.g. via sockets).
   */
  public show(queryText: string, initialResult?: any) {

    console.log("Query WebView is opening for:", queryText);

    this.ensurePanel();

    // Always show loading state first so the user sees feedback.
    this.panel!.webview.postMessage({ type: 'loading', query: queryText });

    if (initialResult) {
      console.log("Rendering pre-fetched query plan result in webview");
      this.panel!.webview.postMessage({
        type: 'analyzeResponse',
        payload: initialResult,
      });
      return;
    }

    console.log("Fetching query plan for:", queryText);

    this.fetchQueryPlan(queryText);
  }

  /**
   * Load a specific analysis by ID (used for async results)
   */
  public async loadAnalysis(analysisId: number) {
    this.ensurePanel();

    // We might not know the query text yet, so we send a generic loading
    this.panel!.webview.postMessage({ type: 'loading', query: "Loading analysis..." });

    try {
      const baseUrl = EnvironmentConfig.getApiBaseUrl();
      const response = await this.authAPI.request(`${baseUrl}/analysis/${analysisId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json() as any;
      console.log("Received analysis by ID:", result);

      this.panel!.webview.postMessage({
        type: 'analyzeResponse',
        payload: result,
      });

      // Update title if possible?
      if (result.query_text) {
        // We could send another message to update the query text in the UI if needed
        // But analyzeResponse usually contains the query text or the UI handles it.
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to load analysis: ${errorMessage}`);
      this.panel!.webview.postMessage({
        type: 'error',
        message: 'Unable to load analysis result.',
      });
    }
  }

  private ensurePanel() {
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
  }

  /**
   * Fetch query plan from backend with authentication
   */
  private async fetchQueryPlan(query: string) {
    try {
      const baseUrl = EnvironmentConfig.getApiBaseUrl();
      const response = await this.authAPI.request(`${baseUrl}/analysis`, {
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

      const result = await response.json() as any;

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

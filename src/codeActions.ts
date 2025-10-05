import * as vscode from "vscode";

export class QRefineCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix
  ];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction[] {
    const diagnostics = vscode.languages.getDiagnostics(document.uri).filter(d =>
      d.range.intersection(range)
    );

    const allDiagnostics = vscode.languages.getDiagnostics(document.uri);

    const fixes = diagnostics.flatMap(diagnostic => this.createFixes(document, diagnostic));

    // ✅ Add multi-fix option
    if (allDiagnostics.length > 1) {
      const fixAll = new vscode.CodeAction(
        "Fix All QRefine Issues in File",
        vscode.CodeActionKind.QuickFix
      );
      fixAll.edit = new vscode.WorkspaceEdit();

      allDiagnostics.forEach(d => {
        const edits = this.createFixes(document, d);
        edits.forEach(e => {
          if (e.edit) {
            e.edit.entries().forEach(([uri, editsForUri]) => {
              editsForUri.forEach((edit: any) => {
                if (edit.range) {
                  fixAll.edit!.replace(uri, edit.range, edit.newText!);
                } else {
                  fixAll.edit!.insert(uri, edit.range!.end, edit.newText!);
                }
              });
            });
          }
        });
      });

      fixes.push(fixAll);
    }

    return fixes;
  }

  private createFixes(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction[] {
    switch (diagnostic.code) {
      case "avoid-select-star":
        return [this.createSelectStarFix(document, diagnostic)];
      case "join-without-condition":
        return [this.createJoinConditionFix(document, diagnostic)];
      case "like-leading-percent":
        return [this.createLikeFix(document, diagnostic)];
      case "order-by-without-limit":
        return [this.createOrderByFix(document, diagnostic)];
      default:
        return [];
    }
  }

  private createSelectStarFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
    const fix = new vscode.CodeAction("Replace * with explicit columns", vscode.CodeActionKind.QuickFix);
    fix.edit = new vscode.WorkspaceEdit();
    fix.edit.replace(document.uri, diagnostic.range, "SELECT col1, col2 -- TODO: replace with real columns");
    fix.diagnostics = [diagnostic];
    return fix;
  }

  private createJoinConditionFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
    const fix = new vscode.CodeAction("Add JOIN condition (ON ...)", vscode.CodeActionKind.QuickFix);
    fix.edit = new vscode.WorkspaceEdit();
    fix.edit.insert(document.uri, diagnostic.range.end, " ON table1.id = table2.id");
    fix.diagnostics = [diagnostic];
    return fix;
  }

  private createLikeFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
    const fix = new vscode.CodeAction("Suggest index-friendly LIKE", vscode.CodeActionKind.QuickFix);
    fix.edit = new vscode.WorkspaceEdit();
    const text = document.getText(diagnostic.range);
    fix.edit.replace(document.uri, diagnostic.range, text.replace(/^LIKE\s+'%/, "LIKE '"));
    fix.diagnostics = [diagnostic];
    return fix;
  }

  private createOrderByFix(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction {
    const fix = new vscode.CodeAction("Add LIMIT to ORDER BY", vscode.CodeActionKind.QuickFix);
    fix.edit = new vscode.WorkspaceEdit();
    fix.edit.insert(document.uri, diagnostic.range.end, " LIMIT 100");
    fix.diagnostics = [diagnostic];
    return fix;
  }
}

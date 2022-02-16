import * as vscode from "vscode";
import { Range } from "./types";
import open from "open";
import newGithubIssueUrl from "new-github-issue-url";
import * as cp from "child_process";
import os from "os";
import { BuildError, FlowistryResult, show } from "./result_types";

let channel = vscode.window.createOutputChannel("Flowistry");
let logs: string[] = [];
export let log = (...strs: any[]) => {
  let s = strs.map((obj) => String(obj)).join("\t");
  logs.push(s);
  channel.appendLine(s);
};

export let to_vsc_range = (
  range: Range,
  doc: vscode.TextDocument
): vscode.Range =>
  new vscode.Range(doc.positionAt(range.start), doc.positionAt(range.end));

export let from_vsc_range = (
  range: vscode.Range,
  doc: vscode.TextDocument
): Range => ({
  start: doc.offsetAt(range.start),
  end: doc.offsetAt(range.end),
  filename: "",
});

export let show_error = async (err: string) => {
  let outcome = await vscode.window.showErrorMessage(
    `Flowistry error: ${err}`,
    "Report bug",
    "Dismiss"
  );
  if (outcome === "Report bug") {
    let log_url = null;
    try {
      log_url = cp.execSync("curl --data-binary @- https://paste.rs/", {
        input: logs.join("\n"),
      });
    } catch (e) {
      log("Failed to call to paste.rs: ", e.toString());
    }

    let bts = "```";
    let log_text = log_url !== null ? `\n**Full log:** ${log_url}` : ``;
    let url = newGithubIssueUrl({
      user: "willcrichton",
      repo: "flowistry",
      body: `# Problem
<!-- Please describe the problem and how you encountered it. -->

# Logs
<!-- You don't need to add or change anything below this point. -->

**OS:** ${os.platform()} (${os.release()})
**VSCode:** ${vscode.version}
**Error message**
${bts}
${err}
${bts}
${log_text}`,
    });

    await open(url);
  }
};

export type CallFlowistry = <T>(args: string, no_output?: boolean) => Promise<FlowistryResult<T>>;

export class FlowistryErrorDocument
  implements vscode.TextDocumentContentProvider
{
  readonly uri = vscode.Uri.parse("flowistry://build-error");
  readonly eventEmitter = new vscode.EventEmitter<vscode.Uri>();
  contents: string = "";

  constructor(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider("flowistry", this)
    );
  }

  provideTextDocumentContent(_uri: vscode.Uri): vscode.ProviderResult<string> {
    return `Flowistry could not run because your project failed to build with error:\n${this.contents}`;
  }

  get onDidChange(): vscode.Event<vscode.Uri> {
    return this.eventEmitter.event;
  }
}

export async function last_error(this: vscode.ExtensionContext) {
  let error = this.workspaceState.get("err_log") as string;
  let flowistry_err: BuildError = { type: "build-error", error };
  await show(flowistry_err);
}

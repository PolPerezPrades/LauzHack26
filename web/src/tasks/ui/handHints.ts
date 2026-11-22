/** Renders the camera checker's feedback (lib/handshapes.ts `HandIssue`) in the UI language. Pure. */
import type { Messages } from "../../i18n/en";
import type { HandIssue } from "../../lib/handshapes";

export function issueText(issue: HandIssue, t: Messages): string {
  return issue.key === "fingers" ? t.learning.fingerHint(issue.action, issue.fingers) : t.learning.hints[issue.key];
}

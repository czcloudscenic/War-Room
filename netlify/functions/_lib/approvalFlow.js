// approvalFlow — the approval state machine, shared by the service-key
// decision endpoint (approval-decision.js) and anything else that advances an
// item without a browser session. src/core/approvals.js keeps its own copy of
// nextStatus (Vite and function bundling don't share source) — if the map
// changes, change BOTH.

// Statuses where an item is sitting at an approval gate.
const NEED_APPROVAL_STATUSES = ["Need Copy Approval", "Need Content Approval"];

/** Which pipeline gate a Need-*-Approval status represents. */
function gateForStatus(status) {
  if (status === "Need Copy Approval") return "copy";
  if (status === "Need Content Approval") return "content";
  return null;
}

/** Next content_items.status for an approval decision at a given gate. */
function nextStatus(decision, gate) {
  if (decision === "revision_requested") return "Needs Revisions";
  if (gate === "copy") return "Ready For Content Creation"; // copy approved → into content production
  return "Approved";                                        // content/client approved
}

module.exports = { NEED_APPROVAL_STATUSES, gateForStatus, nextStatus };

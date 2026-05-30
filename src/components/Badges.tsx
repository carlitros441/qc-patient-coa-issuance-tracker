import type { Assignee, EmailStatus, OverallStatus, WorkflowStatus } from "../types";

export function StatusBadge({ status }: { status: WorkflowStatus | OverallStatus | EmailStatus }) {
  return <span className={`badge status-${status.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}>{status}</span>;
}

export function AssigneeBadge({ assignee }: { assignee: Assignee }) {
  const key = assignee.toLowerCase() === "magda" ? "magda" : assignee.toLowerCase() === "nisha" ? "nisha" : "other";
  return <span className={`badge assignee-${key}`}>{assignee}</span>;
}

import { EMAIL_TEMPLATE } from "../constants";
import type { Assignee, CustomAssayWorkflow, Patient, PatientWorkflow } from "../types";

export const workflowLabels: Record<keyof PatientWorkflow, string> = {
  phenotyping: "Phenotyping",
  requestCells: "Request Cells",
  xCelligence: "XCelligence",
  elisa: "ELISA",
  report: "Report"
};

export const workflowKeys = Object.keys(workflowLabels) as Array<keyof PatientWorkflow>;

export function completedWorkflowCount(workflow: PatientWorkflow) {
  return workflowKeys.filter((key) => workflow[key].status === "Completed").length;
}

export function calculateProgress(workflow: PatientWorkflow) {
  return completedWorkflowCount(workflow) * 20;
}

export function pendingWorkflowSteps(patient: Pick<Patient, "workflow">) {
  return workflowKeys
    .filter((key) => patient.workflow[key].status !== "Completed")
    .map((key) => workflowLabels[key]);
}

export function getGatingAssay(patient: Pick<Patient, "workflow" | "emailNotification">) {
  const pending = workflowKeys.find((key) => patient.workflow[key].status !== "Completed");
  if (pending) return workflowLabels[pending];
  return patient.emailNotification.sent ? "Email Sent" : "Ready for Email Notification";
}

export function isReadyForEmail(patient: Pick<Patient, "workflow" | "emailNotification">) {
  return pendingWorkflowSteps(patient as Patient).length === 0 && !patient.emailNotification.sent;
}

export function buildEmailSubject(patient: Pick<Patient, "patientId" | "project">) {
  return `QC CoA Ready for Patient ${patient.patientId} - ${patient.project}`;
}

export function buildEmailBody(patient: Pick<Patient, "patientId" | "project">, template = EMAIL_TEMPLATE) {
  return template.replaceAll("[Patient ID]", patient.patientId).replaceAll("[Project]", patient.project);
}

export function deriveOverallStatus(patient: Pick<Patient, "workflow" | "emailNotification" | "overallStatus">) {
  if (patient.overallStatus === "Blocked" || patient.overallStatus === "CoA Issued") {
    return patient.overallStatus;
  }
  if (patient.emailNotification.sent) return "Ready for CoA";
  if (isReadyForEmail(patient)) return "Ready for CoA";
  return completedWorkflowCount(patient.workflow) === 0 ? "Not Started" : "In Process";
}

export function assayIdFromName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function mergeCustomAssays(
  current: CustomAssayWorkflow[] | undefined,
  assayTemplates: string[] | undefined,
  assignees: Assignee[] | undefined
) {
  const existing = current ?? [];
  const defaultAssignee = assignees?.[0] ?? "Magda";
  const templates = (assayTemplates ?? [])
    .map((name) => name.trim())
    .filter(Boolean);

  const merged = templates.map((name) => {
    const id = assayIdFromName(name);
    return existing.find((item) => item.id === id || item.name.toLowerCase() === name.toLowerCase()) ?? {
      id,
      name,
      status: "Not Started" as const,
      assignedTo: defaultAssignee,
      notes: ""
    };
  });

  const stillConfigured = new Set(merged.map((item) => item.id));
  return [
    ...merged,
    ...existing.filter((item) => !stillConfigured.has(item.id))
  ];
}

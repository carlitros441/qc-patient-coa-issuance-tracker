import { EMAIL_TEMPLATE } from "../constants";
import type { Patient, PatientWorkflow } from "../types";

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

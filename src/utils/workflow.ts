import { DEFAULT_WORKFLOW_STEPS, EMAIL_TEMPLATE } from "../constants";
import type { Assignee, CustomAssayWorkflow, Patient, PatientWorkflow, WorkflowStepTemplate } from "../types";

export const workflowLabels: Record<keyof PatientWorkflow, string> = {
  phenotyping: "Phenotyping",
  requestCells: "Request Cells",
  xCelligence: "XCelligence",
  elisa: "ELISA",
  report: "Report"
};

export const workflowKeys = Object.keys(workflowLabels) as Array<keyof PatientWorkflow>;

export function buildWorkflowSteps(workflowSteps?: WorkflowStepTemplate[], legacyAssayTemplates?: string[]) {
  const seen = new Set<string>();
  const normalized = (workflowSteps?.length ? workflowSteps : DEFAULT_WORKFLOW_STEPS)
    .map((step) => ({
      ...step,
      id: step.type === "core" ? step.id : assayIdFromName(step.name || step.id),
      name: step.name.trim()
    }))
    .filter((step) => step.id && step.name)
    .filter((step) => {
      if (seen.has(step.id)) return false;
      seen.add(step.id);
      return true;
    });

  const withAllCore = [
    ...normalized,
    ...DEFAULT_WORKFLOW_STEPS.filter((step) => !seen.has(step.id))
  ];
  const legacyCustom = (legacyAssayTemplates ?? [])
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ id: assayIdFromName(name), name, type: "custom" as const }))
    .filter((step) => !withAllCore.some((candidate) => candidate.id === step.id));

  return [...withAllCore, ...legacyCustom];
}

function getStepStatus(patient: Pick<Patient, "workflow" | "customAssays">, step: WorkflowStepTemplate) {
  if (step.type === "core") return patient.workflow[step.id as keyof PatientWorkflow]?.status;
  return patient.customAssays?.find((assay) => assay.id === step.id)?.status;
}

export function completedWorkflowCount(patient: Pick<Patient, "workflow" | "customAssays">, workflowSteps = DEFAULT_WORKFLOW_STEPS) {
  return buildWorkflowSteps(workflowSteps).filter((step) => getStepStatus(patient, step) === "Completed").length;
}

export function calculateProgress(patient: Pick<Patient, "workflow" | "customAssays">, workflowSteps = DEFAULT_WORKFLOW_STEPS) {
  const steps = buildWorkflowSteps(workflowSteps);
  if (steps.length === 0) return 0;
  return Math.round((completedWorkflowCount(patient, steps) / steps.length) * 100);
}

export function pendingWorkflowSteps(patient: Pick<Patient, "workflow" | "customAssays">, workflowSteps = DEFAULT_WORKFLOW_STEPS) {
  return buildWorkflowSteps(workflowSteps)
    .filter((step) => getStepStatus(patient, step) !== "Completed")
    .map((step) => step.name);
}

export function getGatingStep(patient: Pick<Patient, "workflow" | "customAssays" | "emailNotification">, workflowSteps = DEFAULT_WORKFLOW_STEPS) {
  const pending = buildWorkflowSteps(workflowSteps).find((step) => getStepStatus(patient, step) !== "Completed");
  if (pending) return pending.name;
  return patient.emailNotification.sent ? "Email Sent" : "Ready for Email Notification";
}

export function isReadyForEmail(patient: Pick<Patient, "workflow" | "customAssays" | "emailNotification">, workflowSteps = DEFAULT_WORKFLOW_STEPS) {
  return pendingWorkflowSteps(patient, workflowSteps).length === 0 && !patient.emailNotification.sent;
}

export function buildEmailSubject(patient: Pick<Patient, "patientId" | "project">) {
  return `QC CoA Ready for Patient ${patient.patientId} - ${patient.project}`;
}

export function buildEmailBody(patient: Pick<Patient, "patientId" | "project">, template = EMAIL_TEMPLATE) {
  return template.replaceAll("[Patient ID]", patient.patientId).replaceAll("[Project]", patient.project);
}

export function deriveOverallStatus(patient: Pick<Patient, "workflow" | "customAssays" | "emailNotification" | "overallStatus">, workflowSteps = DEFAULT_WORKFLOW_STEPS) {
  if (patient.overallStatus === "Withdrawn/Dropout" || patient.overallStatus === "Blocked" || patient.overallStatus === "CoA Issued") {
    return patient.overallStatus === "Blocked" ? "Withdrawn/Dropout" : patient.overallStatus;
  }
  if (patient.emailNotification.sent) return "Ready for CoA";
  if (isReadyForEmail(patient, workflowSteps)) return "Ready for CoA";
  return completedWorkflowCount(patient, workflowSteps) === 0 ? "Not Started" : "In Process";
}

export function assayIdFromName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function mergeCustomAssays(
  current: CustomAssayWorkflow[] | undefined,
  workflowStepsOrAssayTemplates: WorkflowStepTemplate[] | string[] | undefined,
  assignees: Assignee[] | undefined
) {
  const existing = current ?? [];
  const defaultAssignee = assignees?.[0] ?? "Magda";
  const templates = Array.isArray(workflowStepsOrAssayTemplates) && workflowStepsOrAssayTemplates.length > 0 && typeof workflowStepsOrAssayTemplates[0] === "object"
    ? buildWorkflowSteps(workflowStepsOrAssayTemplates as WorkflowStepTemplate[]).filter((step) => step.type === "custom")
    : (workflowStepsOrAssayTemplates as string[] | undefined ?? []).map((name) => ({ id: assayIdFromName(name), name: name.trim(), type: "custom" as const })).filter((step) => step.name);

  const merged = templates.map((step) => {
    return existing.find((item) => item.id === step.id || item.name.toLowerCase() === step.name.toLowerCase()) ?? {
      id: step.id,
      name: step.name,
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

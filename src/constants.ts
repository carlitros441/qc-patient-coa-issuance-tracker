import type { AppSettings, PatientWorkflow, WorkflowStatus, WorkflowStepTemplate } from "./types";

export const WORKFLOW_STATUSES: WorkflowStatus[] = ["Not Started", "In Process", "Completed"];

export const OVERALL_STATUSES = ["Not Started", "In Process", "Ready for Email", "CoA Issued", "Withdrawn/Dropout"] as const;

export const DEFAULT_WORKFLOW_STEPS: WorkflowStepTemplate[] = [
  { id: "phenotyping", name: "Phenotyping", type: "core" },
  { id: "requestCells", name: "Request Cells", type: "core" },
  { id: "xCelligence", name: "xCELLIGENCE", type: "core" },
  { id: "elisa", name: "ELISA", type: "core" },
  { id: "report", name: "Report", type: "core" }
];

export const EMAIL_TEMPLATE = `Hello,

The QC workflow for Patient [Patient ID] under the [Project] project has been completed.

Completed items:

* Phenotyping
* Request Cells
* xCELLIGENCE
* ELISA
* Report

The patient record is now ready for CoA issuance.

Thank you.`;

export const DEFAULT_SETTINGS: AppSettings = {
  emailRecipients: ["qc-coa-notifications@example.com"],
  projects: ["Co-Exist", "CARE"],
  assignees: ["Magda", "Nisha"],
  assayTemplates: [],
  workflowSteps: DEFAULT_WORKFLOW_STEPS,
  emailTemplate: EMAIL_TEMPLATE,
  userRoles: {}
};

export const defaultWorkflow = (): PatientWorkflow => ({
  phenotyping: {
    status: "Not Started",
    performedDate: null,
    assignedTo: "Magda",
    scheduledDate: null,
    notes: ""
  },
  requestCells: {
    status: "Not Started",
    requestedDate: null,
    assignedTo: "Nisha",
    scheduledDate: null,
    notes: ""
  },
  xCelligence: {
    status: "Not Started",
    assignedTo: "Magda",
    scheduledDate: null,
    notes: ""
  },
  elisa: {
    status: "Not Started",
    assignedTo: "Magda",
    scheduledDate: null,
    notes: ""
  },
  report: {
    status: "Not Started",
    assignedTo: "Nisha",
    scheduledDate: null,
    notes: ""
  }
});

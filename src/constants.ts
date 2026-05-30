import type { AppSettings, PatientWorkflow, WorkflowStatus } from "./types";

export const WORKFLOW_STATUSES: WorkflowStatus[] = ["Not Started", "In Process", "Completed"];

export const OVERALL_STATUSES = ["Not Started", "In Process", "Ready for CoA", "CoA Issued", "Blocked"] as const;

export const EMAIL_TEMPLATE = `Hello,

The QC workflow for Patient [Patient ID] under the [Project] project has been completed.

Completed items:

* Phenotyping
* Request Cells
* XCelligence
* ELISA
* Report

The patient record is now ready for CoA issuance.

Thank you.`;

export const DEFAULT_SETTINGS: AppSettings = {
  emailRecipients: ["qc-coa-notifications@example.com"],
  projects: ["Co-Exist", "CARE"],
  assignees: ["Magda", "Nisha"],
  assayTemplates: [],
  emailTemplate: EMAIL_TEMPLATE,
  userRoles: {}
};

export const defaultWorkflow = (): PatientWorkflow => ({
  phenotyping: {
    status: "Not Started",
    performedDate: null,
    assignedTo: "Magda",
    notes: ""
  },
  requestCells: {
    status: "Not Started",
    requestedDate: null,
    assignedTo: "Nisha",
    notes: ""
  },
  xCelligence: {
    status: "Not Started",
    notes: ""
  },
  elisa: {
    status: "Not Started",
    assignedTo: "Magda",
    notes: ""
  },
  report: {
    status: "Not Started",
    assignedTo: "Nisha",
    notes: ""
  }
});

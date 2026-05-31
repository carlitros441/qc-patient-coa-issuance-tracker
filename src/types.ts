import type { Timestamp } from "firebase/firestore";

export type Project = "Co-Exist" | "CARE" | string;
export type Assignee = "Magda" | "Nisha" | string;
export type WorkflowStatus = "Not Started" | "In Process" | "Completed";
export type OverallStatus = "Not Started" | "In Process" | "Ready for Email" | "CoA Issued" | "Withdrawn/Dropout" | "Ready for CoA" | "Blocked";
export type EmailStatus = "Not Ready" | "Ready to Send" | "Sent" | "Failed";
export type UserRole = "Admin" | "QC User" | "Viewer";

export interface AssignedWorkflowItem {
  status: WorkflowStatus;
  assignedTo: Assignee;
  scheduledDate: string | null;
  notes: string;
}

export interface PhenotypingWorkflow extends AssignedWorkflowItem {
  performedDate: string | null;
}

export interface RequestCellsWorkflow extends AssignedWorkflowItem {
  requestedDate: string | null;
}

export type XCelligenceWorkflow = AssignedWorkflowItem;

export interface PatientWorkflow {
  phenotyping: PhenotypingWorkflow;
  requestCells: RequestCellsWorkflow;
  xCelligence: XCelligenceWorkflow;
  elisa: AssignedWorkflowItem;
  report: AssignedWorkflowItem;
}

export interface CustomAssayWorkflow {
  id: string;
  name: string;
  status: WorkflowStatus;
  assignedTo: Assignee;
  scheduledDate: string | null;
  notes: string;
}

export type CoreWorkflowStepId = keyof PatientWorkflow;

export interface WorkflowStepTemplate {
  id: string;
  name: string;
  type: "core" | "custom";
}

export interface EmailNotification {
  sent: boolean;
  status: EmailStatus;
  sentAt: Timestamp | null;
  recipients: string[];
  subject: string;
  lastError?: string;
}

export interface Patient {
  id: string;
  patientId: string;
  patientIdLower: string;
  project: Project;
  overallStatus: OverallStatus;
  notes: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  createdBy: string;
  updatedBy: string;
  workflow: PatientWorkflow;
  customAssays?: CustomAssayWorkflow[];
  emailNotification: EmailNotification;
}

export interface AppSettings {
  emailRecipients: string[];
  projects: string[];
  assignees: string[];
  assayTemplates: string[];
  workflowSteps: WorkflowStepTemplate[];
  emailTemplate: string;
  userRoles?: Record<string, UserRole>;
}

export interface AuditLog {
  id: string;
  patientDocId: string;
  action: string;
  changedField: string;
  previousValue: unknown;
  newValue: unknown;
  userId: string;
  timestamp: Timestamp | null;
}

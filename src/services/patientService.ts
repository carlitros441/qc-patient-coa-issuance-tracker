import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "firebase/firestore";
import { db } from "../firebase";
import { defaultWorkflow } from "../constants";
import type { AdditionalAssay, AuditLog, CustomAssayWorkflow, OverallStatus, Patient, PatientWorkflow, Project, WorkflowStepTemplate } from "../types";
import { buildEmailSubject, deriveOverallStatus, isReadyForEmail } from "../utils/workflow";

const patientsCollection = collection(db, "patients");

export function subscribePatients(callback: (patients: Patient[]) => void) {
  return onSnapshot(query(patientsCollection, orderBy("updatedAt", "desc")), (snapshot) => {
    callback(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Patient));
  });
}

export function subscribePatient(id: string, callback: (patient: Patient | null) => void) {
  return onSnapshot(doc(db, "patients", id), (docSnap) => {
    callback(docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Patient) : null);
  });
}

export function subscribeAuditLogs(patientDocId: string, callback: (logs: AuditLog[]) => void) {
  return onSnapshot(
    query(collection(db, "auditLogs"), where("patientDocId", "==", patientDocId), orderBy("timestamp", "desc"), limit(50)),
    (snapshot) => callback(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as AuditLog))
  );
}

export async function ensureUniquePatientId(patientId: string) {
  const q = query(patientsCollection, where("patientIdLower", "==", patientId.trim().toLowerCase()), limit(1));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    throw new Error("A patient with this coded identifier already exists.");
  }
}

export async function createPatient(input: { patientId: string; project: Project; notes: string; userId: string }) {
  const patientId = input.patientId.trim();
  if (!patientId) throw new Error("Patient ID is required.");
  await ensureUniquePatientId(patientId);
  const workflow = defaultWorkflow();

  return addDoc(patientsCollection, {
    patientId,
    patientIdLower: patientId.toLowerCase(),
    project: input.project,
    overallStatus: "Not Started" satisfies OverallStatus,
    notes: input.notes.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: input.userId,
    updatedBy: input.userId,
    workflow,
    emailNotification: {
      sent: false,
      status: "Not Ready",
      sentAt: null,
      recipients: [],
      subject: buildEmailSubject({ patientId, project: input.project }),
      lastError: ""
    }
  });
}

export async function updatePatientInfo(
  patient: Patient,
  input: { project: Project; overallStatus: OverallStatus; notes: string; userId: string; workflowSteps?: WorkflowStepTemplate[] }
) {
  const nextStatus = input.overallStatus === "Withdrawn/Dropout"
    ? "Withdrawn/Dropout"
    : deriveOverallStatus({ ...patient, overallStatus: input.overallStatus }, input.workflowSteps);
  await updateDoc(doc(db, "patients", patient.id), {
    project: input.project,
    overallStatus: nextStatus,
    notes: input.notes.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: input.userId
  });
  await logAudit(patient.id, "Updated patient information", "patient", { project: patient.project, notes: patient.notes }, input, input.userId);
}

export async function updateWorkflow(
  patient: Patient,
  workflow: PatientWorkflow,
  userId: string,
  customAssays?: CustomAssayWorkflow[],
  workflowSteps?: WorkflowStepTemplate[]
) {
  const computedPatient = { ...patient, workflow, customAssays: customAssays ?? [] };
  const ready = isReadyForEmail(computedPatient, workflowSteps);

  await updateDoc(doc(db, "patients", patient.id), {
    workflow,
    customAssays: customAssays ?? [],
    overallStatus: deriveOverallStatus(computedPatient, workflowSteps),
    "emailNotification.status": ready ? "Ready to Send" : patient.emailNotification.sent ? "Sent" : "Not Ready",
    "emailNotification.subject": buildEmailSubject(patient),
    updatedAt: serverTimestamp(),
    updatedBy: userId
  });
  await logAudit(patient.id, "Updated workflow", "workflow", { workflow: patient.workflow, customAssays: patient.customAssays ?? [] }, { workflow, customAssays: customAssays ?? [] }, userId);
}

export async function manuallyConfirmEmailSent(
  patient: Patient,
  input: { userId: string; recipients: string[]; subject: string; workflowSteps?: WorkflowStepTemplate[] }
) {
  await updateDoc(doc(db, "patients", patient.id), {
    overallStatus: "CoA Issued",
    "emailNotification.sent": true,
    "emailNotification.status": "Sent",
    "emailNotification.sentAt": serverTimestamp(),
    "emailNotification.recipients": input.recipients,
    "emailNotification.subject": input.subject,
    "emailNotification.lastError": "",
    updatedAt: serverTimestamp(),
    updatedBy: input.userId
  });
  await logAudit(patient.id, "Manually confirmed email notification sent", "emailNotification", patient.emailNotification, { status: "Sent", sent: true }, input.userId);
}

export async function updateAdditionalAssays(patient: Patient, additionalAssays: AdditionalAssay[], userId: string) {
  await updateDoc(doc(db, "patients", patient.id), {
    additionalAssays,
    updatedAt: serverTimestamp(),
    updatedBy: userId
  });
  await logAudit(patient.id, "Updated additional assays", "additionalAssays", patient.additionalAssays ?? [], additionalAssays, userId);
}

export async function logAudit(
  patientDocId: string,
  action: string,
  changedField: string,
  previousValue: unknown,
  newValue: unknown,
  userId: string
) {
  await addDoc(collection(db, "auditLogs"), {
    patientDocId,
    action,
    changedField,
    previousValue: JSON.stringify(previousValue ?? null).slice(0, 2000),
    newValue: JSON.stringify(newValue ?? null).slice(0, 2000),
    userId,
    timestamp: serverTimestamp()
  });
}

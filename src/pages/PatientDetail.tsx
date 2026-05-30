import type { User } from "firebase/auth";
import { Mail, Save } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AssigneeBadge, StatusBadge } from "../components/Badges";
import { Modal } from "../components/Modal";
import { ProgressBar } from "../components/ProgressBar";
import { WORKFLOW_STATUSES, OVERALL_STATUSES } from "../constants";
import { sendEmailNotification } from "../services/emailService";
import { subscribeAuditLogs, subscribePatient, updatePatientInfo, updateWorkflow } from "../services/patientService";
import { subscribeSettings } from "../services/settingsService";
import type { AppSettings, AssignedWorkflowItem, AuditLog, Patient, PatientWorkflow, PhenotypingWorkflow, RequestCellsWorkflow, WorkflowStatus, XCelligenceWorkflow } from "../types";
import { buildEmailBody, buildEmailSubject, calculateProgress, isReadyForEmail, pendingWorkflowSteps, workflowLabels } from "../utils/workflow";

export function PatientDetail({ user }: { user: User }) {
  const { id } = useParams();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [workflowDraft, setWorkflowDraft] = useState<PatientWorkflow | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    const unsubPatient = subscribePatient(id, (nextPatient) => {
      setPatient(nextPatient);
      if (nextPatient) setWorkflowDraft(nextPatient.workflow);
    });
    const unsubAudit = subscribeAuditLogs(id, setAuditLogs);
    const unsubSettings = subscribeSettings(setSettings);
    return () => {
      unsubPatient();
      unsubAudit();
      unsubSettings();
    };
  }, [id]);

  const emailPreview = useMemo(() => {
    if (!patient) return null;
    return {
      recipients: settings?.emailRecipients ?? [],
      subject: buildEmailSubject(patient),
      body: buildEmailBody(patient, settings?.emailTemplate)
    };
  }, [patient, settings]);

  if (!patient || !workflowDraft) return <main className="page"><div className="loading">Loading patient...</div></main>;

  const ready = isReadyForEmail(patient);
  const pending = pendingWorkflowSteps(patient);

  async function saveInfo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!patient) return;
    const form = new FormData(event.currentTarget);
    await updatePatientInfo(patient, {
      project: String(form.get("project")),
      overallStatus: String(form.get("overallStatus")) as Patient["overallStatus"],
      notes: String(form.get("notes") ?? ""),
      userId: user.uid
    });
    setMessage("Patient information saved.");
  }

  async function saveWorkflow() {
    if (!patient || !workflowDraft) return;
    await updateWorkflow(patient, workflowDraft, user.uid);
    setMessage("Workflow saved.");
  }

  async function confirmSendEmail() {
    if (!patient || !emailPreview) return;
    setError("");
    try {
      await sendEmailNotification({
        patientDocId: patient.id,
        recipients: emailPreview.recipients,
        subject: emailPreview.subject,
        body: emailPreview.body
      });
      setMessage("Email notification sent.");
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email send failed.");
    }
  }

  return (
    <main className="page detail-grid">
      <section className="panel hero-panel">
        <div>
          <p className="eyebrow">Patient record</p>
          <h2>{patient.patientId}</h2>
          <p className="muted">Use coded identifiers only unless your Firebase project is authorized for PHI.</p>
        </div>
        <div className="detail-actions">
          <StatusBadge status={ready ? "Ready to Send" : patient.overallStatus} />
          <ProgressBar value={calculateProgress(patient.workflow)} />
        </div>
      </section>

      <section className="panel">
        <h3>Patient Information</h3>
        <form className="two-column-form" onSubmit={saveInfo}>
          <label>Project<input name="project" defaultValue={patient.project} /></label>
          <label>Overall status<select name="overallStatus" defaultValue={patient.overallStatus}>{OVERALL_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="span-2">Notes<textarea name="notes" defaultValue={patient.notes} rows={3} /></label>
          <button className="primary" type="submit"><Save size={18} />Save info</button>
        </form>
      </section>

      <section className="panel workflow-panel">
        <div className="section-heading">
          <h3>Workflow Tracking</h3>
          <button className="primary" type="button" onClick={saveWorkflow}><Save size={18} />Save workflow</button>
        </div>
        <WorkflowEditor workflow={workflowDraft} setWorkflow={setWorkflowDraft} assignees={settings?.assignees ?? ["Magda", "Nisha"]} />
      </section>

      <section className="panel email-panel">
        <div className="section-heading">
          <h3>Email Notification</h3>
          <StatusBadge status={patient.emailNotification.status} />
        </div>
        {ready ? <p className="ready-note">Ready for Email Notification</p> : <p className="muted">Pending: {pending.join(", ") || "None"}</p>}
        <button className="primary" disabled={!ready} onClick={() => setModalOpen(true)}><Mail size={18} />Send Email Notification</button>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="panel audit-panel">
        <h3>Audit / History Log</h3>
        <div className="audit-list">
          {auditLogs.map((log) => (
            <div key={log.id} className="audit-item">
              <strong>{log.action}</strong>
              <span>{log.changedField}</span>
              <small>{log.timestamp?.toDate().toLocaleString() ?? "Pending timestamp"}</small>
            </div>
          ))}
          {auditLogs.length === 0 && <p className="empty">No audit events yet.</p>}
        </div>
      </section>

      {modalOpen && emailPreview && (
        <Modal
          title="Confirm Email Notification"
          onClose={() => setModalOpen(false)}
          footer={<><button className="ghost" onClick={() => setModalOpen(false)}>Cancel</button><button className="primary" onClick={confirmSendEmail}>Confirm send</button></>}
        >
          <dl className="preview-list">
            <dt>Patient ID</dt><dd>{patient.patientId}</dd>
            <dt>Project</dt><dd>{patient.project}</dd>
            <dt>Completed workflow</dt><dd>{Object.values(workflowLabels).join(", ")}</dd>
            <dt>Recipients</dt><dd>{emailPreview.recipients.join(", ") || "No recipients configured"}</dd>
            <dt>Subject</dt><dd>{emailPreview.subject}</dd>
          </dl>
          <pre className="email-preview">{emailPreview.body}</pre>
        </Modal>
      )}
    </main>
  );
}

function WorkflowEditor({
  workflow,
  setWorkflow,
  assignees
}: {
  workflow: PatientWorkflow;
  setWorkflow: (workflow: PatientWorkflow) => void;
  assignees: string[];
}) {
  return (
    <div className="workflow-grid">
      <AssignedSection title="Phenotyping" item={workflow.phenotyping} dateKey="performedDate" dateLabel="Date assay performed" assignees={assignees} onChange={(item) => setWorkflow({ ...workflow, phenotyping: item })} />
      <AssignedSection title="Request Cells" item={workflow.requestCells} dateKey="requestedDate" dateLabel="Date cells requested" assignees={assignees} onChange={(item) => setWorkflow({ ...workflow, requestCells: item })} />
      <SimpleSection title="XCelligence" item={workflow.xCelligence} onChange={(item) => setWorkflow({ ...workflow, xCelligence: item })} />
      <AssignedSection title="ELISA" item={workflow.elisa} assignees={assignees} onChange={(item) => setWorkflow({ ...workflow, elisa: item })} />
      <AssignedSection title="Report" item={workflow.report} assignees={assignees} onChange={(item) => setWorkflow({ ...workflow, report: item })} />
    </div>
  );
}

type DatedAssignedWorkflowItem = AssignedWorkflowItem | PhenotypingWorkflow | RequestCellsWorkflow;

interface AssignedSectionProps<T extends DatedAssignedWorkflowItem> {
  title: string;
  item: T;
  onChange: (item: T) => void;
  assignees: string[];
  dateKey?: "performedDate" | "requestedDate";
  dateLabel?: string;
}

function AssignedSection<T extends DatedAssignedWorkflowItem>({ title, item, onChange, assignees, dateKey, dateLabel }: AssignedSectionProps<T>) {
  return (
    <section className="workflow-card">
      <header><h4>{title}</h4><AssigneeBadge assignee={item.assignedTo} /></header>
      <label>Status<select value={item.status} onChange={(event) => onChange({ ...item, status: event.target.value as WorkflowStatus })}>{WORKFLOW_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
      {dateKey && <label>{dateLabel}<input type="date" value={String((item as unknown as Record<string, unknown>)[dateKey] ?? "")} onChange={(event) => onChange({ ...item, [dateKey]: event.target.value || null })} /></label>}
      <label>Assigned person<select value={item.assignedTo} onChange={(event) => onChange({ ...item, assignedTo: event.target.value })}>{assignees.map((name: string) => <option key={name}>{name}</option>)}</select></label>
      <label>Notes<textarea rows={3} value={item.notes} onChange={(event) => onChange({ ...item, notes: event.target.value })} /></label>
    </section>
  );
}

function SimpleSection({ title, item, onChange }: { title: string; item: XCelligenceWorkflow; onChange: (item: XCelligenceWorkflow) => void }) {
  return (
    <section className="workflow-card">
      <header><h4>{title}</h4><StatusBadge status={item.status} /></header>
      <label>Status<select value={item.status} onChange={(event) => onChange({ ...item, status: event.target.value as WorkflowStatus })}>{WORKFLOW_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
      <label>Notes<textarea rows={3} value={item.notes} onChange={(event) => onChange({ ...item, notes: event.target.value })} /></label>
    </section>
  );
}

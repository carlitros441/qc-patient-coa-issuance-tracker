import type { User } from "firebase/auth";
import { Mail, Plus, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AssigneeBadge, StatusBadge } from "../components/Badges";
import { Modal } from "../components/Modal";
import { ProgressBar } from "../components/ProgressBar";
import { WORKFLOW_STATUSES } from "../constants";
import { sendEmailNotification } from "../services/emailService";
import { manuallyConfirmEmailSent, subscribeAuditLogs, subscribePatient, updateAdditionalAssays, updatePatientInfo, updateWorkflow } from "../services/patientService";
import { subscribeSettings } from "../services/settingsService";
import type { AdditionalAssay, AppSettings, AssignedWorkflowItem, AuditLog, CustomAssayWorkflow, Patient, PatientWorkflow, PhenotypingWorkflow, RequestCellsWorkflow, WorkflowStatus } from "../types";
import { assayIdFromName, buildEmailBody, buildEmailSubject, calculateProgress, isReadyForEmail, mergeCustomAssays, pendingWorkflowSteps, workflowLabels } from "../utils/workflow";

export function PatientDetail({ user }: { user: User }) {
  const { id } = useParams();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [workflowDraft, setWorkflowDraft] = useState<PatientWorkflow | null>(null);
  const [customAssaysDraft, setCustomAssaysDraft] = useState<CustomAssayWorkflow[]>([]);
  const [additionalAssaysDraft, setAdditionalAssaysDraft] = useState<AdditionalAssay[]>([]);
  const [newAdditionalAssayName, setNewAdditionalAssayName] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    const unsubPatient = subscribePatient(id, (nextPatient) => {
      setPatient(nextPatient);
      if (nextPatient) {
        setWorkflowDraft({
          ...nextPatient.workflow,
          xCelligence: {
            ...nextPatient.workflow.xCelligence,
            assignedTo: nextPatient.workflow.xCelligence.assignedTo ?? "Magda",
            scheduledDate: nextPatient.workflow.xCelligence.scheduledDate ?? null
          }
        });
        setAdditionalAssaysDraft(nextPatient.additionalAssays ?? []);
      }
    });
    const unsubAudit = subscribeAuditLogs(id, setAuditLogs);
    const unsubSettings = subscribeSettings(setSettings);
    return () => {
      unsubPatient();
      unsubAudit();
      unsubSettings();
    };
  }, [id]);

  useEffect(() => {
    if (!patient || !settings) return;
    setCustomAssaysDraft(mergeCustomAssays(patient.customAssays, settings.workflowSteps, settings.assignees));
  }, [patient, settings]);

  const emailPreview = useMemo(() => {
    if (!patient) return null;
    return {
      recipients: settings?.emailRecipients ?? [],
      subject: buildEmailSubject(patient),
      body: buildEmailBody(patient, settings?.emailTemplate)
    };
  }, [patient, settings]);

  if (!patient || !workflowDraft) return <main className="page"><div className="loading">Loading patient...</div></main>;

  const workflowSteps = settings?.workflowSteps ?? [];
  const ready = isReadyForEmail(patient, workflowSteps);
  const pending = pendingWorkflowSteps(patient, workflowSteps);

  async function saveInfo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!patient) return;
    const form = new FormData(event.currentTarget);
    const statusValue = String(form.get("overallStatus"));
    await updatePatientInfo(patient, {
      project: String(form.get("project")),
      overallStatus: (statusValue === "Auto" ? "Not Started" : statusValue) as Patient["overallStatus"],
      notes: String(form.get("notes") ?? ""),
      userId: user.uid,
      workflowSteps
    });
    setMessage("Patient information saved.");
  }

  async function saveWorkflow() {
    if (!patient || !workflowDraft) return;
    await updateWorkflow(patient, workflowDraft, user.uid, customAssaysDraft, workflowSteps);
    setMessage("Workflow saved.");
  }

  async function saveAdditionalAssays() {
    if (!patient) return;
    await updateAdditionalAssays(patient, additionalAssaysDraft, user.uid);
    setMessage("Additional assays saved.");
  }

  function addAdditionalAssay() {
    const name = newAdditionalAssayName.trim();
    if (!name) return;
    const id = `${assayIdFromName(name)}-${Date.now()}`;
    setAdditionalAssaysDraft([
      ...additionalAssaysDraft,
      {
        id,
        name,
        status: "Not Started",
        assignedTo: settings?.assignees?.[0] ?? "Magda",
        scheduledDate: null,
        notes: ""
      }
    ]);
    setNewAdditionalAssayName("");
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

  async function confirmManualEmailSent() {
    if (!patient || !emailPreview) return;
    setError("");
    try {
      await manuallyConfirmEmailSent(patient, {
        userId: user.uid,
        recipients: emailPreview.recipients,
        subject: emailPreview.subject,
        workflowSteps
      });
      setMessage("Email notification manually confirmed as sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to confirm email sent.");
    }
  }

  function downloadOutlookDraft() {
    if (!patient || !emailPreview) return;
    const headers = [
      "X-Unsent: 1",
      `To: ${emailPreview.recipients.join(", ")}`,
      `Subject: ${emailPreview.subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      emailPreview.body
    ];
    const blob = new Blob([headers.join("\r\n")], { type: "message/rfc822;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `QC-CoA-${patient.patientId.replace(/[^a-z0-9-]/gi, "_")}.eml`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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
          <StatusBadge status={ready ? "Ready to Send" : patient.overallStatus === "Blocked" ? "Withdrawn/Dropout" : patient.overallStatus === "Ready for CoA" ? "Ready for Email" : patient.overallStatus} />
          <ProgressBar value={calculateProgress(patient, workflowSteps)} />
        </div>
      </section>

      <section className="panel">
        <h3>Patient Information</h3>
        <form className="two-column-form" onSubmit={saveInfo}>
          <label>Project<select name="project" defaultValue={patient.project}>{(settings?.projects ?? ["Co-Exist", "CARE"]).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Overall status<select name="overallStatus" defaultValue={patient.overallStatus === "Withdrawn/Dropout" || patient.overallStatus === "Blocked" ? "Withdrawn/Dropout" : "Auto"}><option value="Auto">Automatic: {patient.overallStatus === "Ready for CoA" ? "Ready for Email" : patient.overallStatus}</option><option>Withdrawn/Dropout</option></select></label>
          <label className="span-2">Notes<textarea name="notes" defaultValue={patient.notes} rows={3} /></label>
          <button className="primary" type="submit"><Save size={18} />Save info</button>
        </form>
      </section>

      <section className="panel workflow-panel">
        <div className="section-heading">
          <h3>Workflow Tracking</h3>
          <button className="primary" type="button" onClick={saveWorkflow}><Save size={18} />Save workflow</button>
        </div>
        <WorkflowEditor
          workflow={workflowDraft}
          setWorkflow={setWorkflowDraft}
          customAssays={customAssaysDraft}
          setCustomAssays={setCustomAssaysDraft}
          assignees={settings?.assignees ?? ["Magda", "Nisha"]}
          workflowSteps={workflowSteps}
        />
      </section>

      <section className="panel email-panel">
        <div className="section-heading">
          <h3>Email Notification</h3>
          <StatusBadge status={patient.emailNotification.status} />
        </div>
        {ready ? <p className="ready-note">Ready for Email Notification</p> : <p className="muted">Pending: {pending.join(", ") || "None"}</p>}
        <button className="primary" disabled={!ready} onClick={() => setModalOpen(true)}><Mail size={18} />Send Email Notification</button>
        <button className="ghost" disabled={!ready} onClick={confirmManualEmailSent}>Confirm Email Sent Manually</button>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="panel additional-assays-panel">
        <div className="section-heading">
          <div>
            <h3>Additional Assays</h3>
            <p className="muted">Patient-specific assays here do not affect workflow gating or progress.</p>
          </div>
          <button className="primary" type="button" onClick={saveAdditionalAssays}><Save size={18} />Save additional assays</button>
        </div>
        <div className="add-assay-row">
          <input value={newAdditionalAssayName} placeholder="Add patient-specific assay" onChange={(event) => setNewAdditionalAssayName(event.target.value)} />
          <button className="ghost" type="button" onClick={addAdditionalAssay}><Plus size={18} />Add assay</button>
        </div>
        {additionalAssaysDraft.length > 0 ? (
          <div className="workflow-grid">
            {additionalAssaysDraft.map((assay) => (
              <AssignedSection
                key={assay.id}
                title={assay.name}
                item={assay}
                assignees={settings?.assignees ?? ["Magda", "Nisha"]}
                onChange={(item) => setAdditionalAssaysDraft(additionalAssaysDraft.map((candidate) => candidate.id === assay.id ? item : candidate))}
                onRemove={() => setAdditionalAssaysDraft(additionalAssaysDraft.filter((candidate) => candidate.id !== assay.id))}
              />
            ))}
          </div>
        ) : (
          <p className="empty">No patient-specific additional assays have been added.</p>
        )}
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
          footer={<><button className="ghost" onClick={() => setModalOpen(false)}>Cancel</button><button className="ghost" onClick={downloadOutlookDraft}>Download Outlook Draft</button><button className="primary" onClick={confirmSendEmail}>Confirm send</button></>}
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
  customAssays,
  setCustomAssays,
  assignees,
  workflowSteps
}: {
  workflow: PatientWorkflow;
  setWorkflow: (workflow: PatientWorkflow) => void;
  customAssays: CustomAssayWorkflow[];
  setCustomAssays: (assays: CustomAssayWorkflow[]) => void;
  assignees: string[];
  workflowSteps: AppSettings["workflowSteps"];
}) {
  const customById = new Map(customAssays.map((assay) => [assay.id, assay]));

  return (
    <div className="workflow-grid">
      {workflowSteps.map((step) => {
        if (step.id === "phenotyping") {
          return <AssignedSection key={step.id} title={step.name} item={workflow.phenotyping} assignees={assignees} onChange={(item) => setWorkflow({ ...workflow, phenotyping: item })} />;
        }
        if (step.id === "requestCells") {
          return <AssignedSection key={step.id} title={step.name} item={workflow.requestCells} assignees={assignees} onChange={(item) => setWorkflow({ ...workflow, requestCells: item })} />;
        }
        if (step.id === "xCelligence") {
          return <AssignedSection key={step.id} title={step.name} item={workflow.xCelligence} assignees={assignees} onChange={(item) => setWorkflow({ ...workflow, xCelligence: item })} />;
        }
        if (step.id === "elisa") {
          return <AssignedSection key={step.id} title={step.name} item={workflow.elisa} assignees={assignees} onChange={(item) => setWorkflow({ ...workflow, elisa: item })} />;
        }
        if (step.id === "report") {
          return <AssignedSection key={step.id} title={step.name} item={workflow.report} assignees={assignees} onChange={(item) => setWorkflow({ ...workflow, report: item })} />;
        }

        const assay = customById.get(step.id);
        if (!assay) return null;
        return (
          <AssignedSection
            key={step.id}
            title={step.name}
            item={{ ...assay, name: step.name }}
            assignees={assignees}
            onChange={(item) => setCustomAssays(customAssays.map((candidate) => candidate.id === step.id ? item : candidate))}
          />
        );
      })}
    </div>
  );
}

type DatedAssignedWorkflowItem = AssignedWorkflowItem | PhenotypingWorkflow | RequestCellsWorkflow | CustomAssayWorkflow | AdditionalAssay;

interface AssignedSectionProps<T extends DatedAssignedWorkflowItem> {
  title: string;
  item: T;
  onChange: (item: T) => void;
  assignees: string[];
  onRemove?: () => void;
}

function getScheduleDate(item: DatedAssignedWorkflowItem) {
  const legacyDates = item as DatedAssignedWorkflowItem & { performedDate?: string | null; requestedDate?: string | null };
  return item.scheduledDate ?? legacyDates.performedDate ?? legacyDates.requestedDate ?? "";
}

function AssignedSection<T extends DatedAssignedWorkflowItem>({ title, item, onChange, assignees, onRemove }: AssignedSectionProps<T>) {
  return (
    <section className="workflow-card">
      <header>
        <h4>{title}</h4>
        <div className="workflow-card-actions">
          <AssigneeBadge assignee={item.assignedTo} />
          {onRemove && <button className="icon-button" type="button" aria-label={`Remove ${title}`} onClick={onRemove}><Trash2 size={16} /></button>}
        </div>
      </header>
      <label>Status<select value={item.status} onChange={(event) => onChange({ ...item, status: event.target.value as WorkflowStatus })}>{WORKFLOW_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
      <label>Schedule Date<input type="date" value={getScheduleDate(item)} onChange={(event) => onChange({ ...item, scheduledDate: event.target.value || null })} /></label>
      <label>Analyst<select value={item.assignedTo} onChange={(event) => onChange({ ...item, assignedTo: event.target.value })}>{assignees.map((name: string) => <option key={name}>{name}</option>)}</select></label>
      <label>Notes<textarea rows={3} value={item.notes} onChange={(event) => onChange({ ...item, notes: event.target.value })} /></label>
    </section>
  );
}

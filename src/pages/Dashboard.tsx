import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../components/Badges";
import { ProgressBar } from "../components/ProgressBar";
import { DEFAULT_SETTINGS, OVERALL_STATUSES } from "../constants";
import { subscribePatients } from "../services/patientService";
import { subscribeSettings } from "../services/settingsService";
import type { AppSettings, Patient } from "../types";
import { calculateProgress, getGatingStep, isReadyForEmail } from "../utils/workflow";

export function Dashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [project, setProject] = useState("All");
  const [status, setStatus] = useState("All");
  const [assignee, setAssignee] = useState("All");
  const [readyOnly, setReadyOnly] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => subscribePatients(setPatients), []);
  useEffect(() => subscribeSettings(setSettings), []);

  const filtered = useMemo(() => patients.filter((patient) => {
    const assignments = [
      patient.workflow.phenotyping.assignedTo,
      patient.workflow.requestCells.assignedTo,
      patient.workflow.elisa.assignedTo,
      patient.workflow.report.assignedTo,
      ...(patient.customAssays ?? []).map((item) => item.assignedTo)
    ];
    return (project === "All" || patient.project === project)
      && (status === "All" || patient.overallStatus === status || (status === "Withdrawn/Dropout" && patient.overallStatus === "Blocked"))
      && (assignee === "All" || assignments.includes(assignee))
      && (!readyOnly || isReadyForEmail(patient, settings.workflowSteps))
      && patient.patientId.toLowerCase().includes(search.toLowerCase());
  }), [patients, project, status, assignee, readyOnly, search, settings.workflowSteps]);

  const totals = {
    total: patients.length,
    coExist: patients.filter((patient) => patient.project === "Co-Exist").length,
    care: patients.filter((patient) => patient.project === "CARE").length,
    ready: patients.filter((patient) => isReadyForEmail(patient, settings.workflowSteps)).length,
    issued: patients.filter((patient) => patient.overallStatus === "CoA Issued").length,
    withdrawn: patients.filter((patient) => patient.overallStatus === "Withdrawn/Dropout" || patient.overallStatus === "Blocked").length
  };

  return (
    <main className="page stack">
      <details className="summary-dropdown">
        <summary>Dashboard summary</summary>
        <section className="summary-grid">
          <Summary label="Total patients" value={totals.total} />
          <Summary label="Co-Exist patients" value={totals.coExist} />
          <Summary label="CARE patients" value={totals.care} />
          <Summary label="Ready for Email" value={totals.ready} />
          <Summary label="CoA Issued" value={totals.issued} />
          <Summary label="Withdrawn/Dropout" value={totals.withdrawn} />
        </section>
      </details>

      <section className="panel filters compact-filters">
        <select value={project} onChange={(event) => setProject(event.target.value)}>
          <option>All</option>
          {settings.projects.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option>All</option>
          {OVERALL_STATUSES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
          <option>All</option>
          {settings.assignees.map((item) => <option key={item}>{item}</option>)}
        </select>
        <label className="toggle"><input type="checkbox" checked={readyOnly} onChange={(event) => setReadyOnly(event.target.checked)} />Ready for email</label>
        <div className="search"><Search size={18} /><input placeholder="Search patient ID" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      </section>

      <section className="patient-grid">
        {filtered.map((patient) => <PatientCard key={patient.id} patient={patient} settings={settings} />)}
        {filtered.length === 0 && <div className="empty">No patient records match the current filters.</div>}
      </section>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="summary-card"><span>{label}</span><strong>{value}</strong></div>;
}

function PatientCard({ patient, settings }: { patient: Patient; settings: AppSettings }) {
  const progress = calculateProgress(patient, settings.workflowSteps);
  return (
    <Link to={`/patients/${patient.id}`} className="patient-card">
      <div className="card-top">
        <div>
          <h2>{patient.patientId}</h2>
          <p>{patient.project}</p>
        </div>
        <StatusBadge status={isReadyForEmail(patient, settings.workflowSteps) ? "Ready to Send" : patient.overallStatus === "Blocked" ? "Withdrawn/Dropout" : patient.overallStatus} />
      </div>
      <ProgressBar value={progress} />
      <p className="gating-line">Gating Step: <strong>{getGatingStep(patient, settings.workflowSteps)}</strong></p>
      <div className="meta-line">
        <span>Email: {patient.emailNotification.status}</span>
        <span>{patient.updatedAt?.toDate().toLocaleDateString() ?? "New"}</span>
      </div>
    </Link>
  );
}

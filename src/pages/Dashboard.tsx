import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AssigneeBadge, StatusBadge } from "../components/Badges";
import { ProgressBar } from "../components/ProgressBar";
import { OVERALL_STATUSES } from "../constants";
import { subscribePatients } from "../services/patientService";
import type { Patient } from "../types";
import { calculateProgress, isReadyForEmail } from "../utils/workflow";

export function Dashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [project, setProject] = useState("All");
  const [status, setStatus] = useState("All");
  const [assignee, setAssignee] = useState("All");
  const [readyOnly, setReadyOnly] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => subscribePatients(setPatients), []);

  const filtered = useMemo(() => patients.filter((patient) => {
    const assignments = [
      patient.workflow.phenotyping.assignedTo,
      patient.workflow.requestCells.assignedTo,
      patient.workflow.elisa.assignedTo,
      patient.workflow.report.assignedTo
    ];
    return (project === "All" || patient.project === project)
      && (status === "All" || patient.overallStatus === status)
      && (assignee === "All" || assignments.includes(assignee))
      && (!readyOnly || isReadyForEmail(patient))
      && patient.patientId.toLowerCase().includes(search.toLowerCase());
  }), [patients, project, status, assignee, readyOnly, search]);

  const totals = {
    total: patients.length,
    coExist: patients.filter((patient) => patient.project === "Co-Exist").length,
    care: patients.filter((patient) => patient.project === "CARE").length,
    ready: patients.filter(isReadyForEmail).length,
    issued: patients.filter((patient) => patient.overallStatus === "CoA Issued").length,
    blocked: patients.filter((patient) => patient.overallStatus === "Blocked").length
  };

  return (
    <main className="page stack">
      <section className="summary-grid">
        <Summary label="Total patients" value={totals.total} />
        <Summary label="Co-Exist patients" value={totals.coExist} />
        <Summary label="CARE patients" value={totals.care} />
        <Summary label="Ready for Email" value={totals.ready} />
        <Summary label="CoA Issued" value={totals.issued} />
        <Summary label="Blocked" value={totals.blocked} />
      </section>

      <section className="panel filters">
        <select value={project} onChange={(event) => setProject(event.target.value)}>
          <option>All</option>
          <option>Co-Exist</option>
          <option>CARE</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option>All</option>
          {OVERALL_STATUSES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
          <option>All</option>
          <option>Magda</option>
          <option>Nisha</option>
        </select>
        <label className="toggle"><input type="checkbox" checked={readyOnly} onChange={(event) => setReadyOnly(event.target.checked)} />Ready for email</label>
        <div className="search"><Search size={18} /><input placeholder="Search patient ID" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      </section>

      <section className="patient-grid">
        {filtered.map((patient) => <PatientCard key={patient.id} patient={patient} />)}
        {filtered.length === 0 && <div className="empty">No patient records match the current filters.</div>}
      </section>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="summary-card"><span>{label}</span><strong>{value}</strong></div>;
}

function PatientCard({ patient }: { patient: Patient }) {
  const progress = calculateProgress(patient.workflow);
  return (
    <Link to={`/patients/${patient.id}`} className="patient-card">
      <div className="card-top">
        <div>
          <h2>{patient.patientId}</h2>
          <p>{patient.project}</p>
        </div>
        <StatusBadge status={isReadyForEmail(patient) ? "Ready to Send" : patient.overallStatus} />
      </div>
      <ProgressBar value={progress} />
      <div className="badge-row">
        <AssigneeBadge assignee={patient.workflow.phenotyping.assignedTo} />
        <AssigneeBadge assignee={patient.workflow.requestCells.assignedTo} />
        <AssigneeBadge assignee={patient.workflow.elisa.assignedTo} />
        <AssigneeBadge assignee={patient.workflow.report.assignedTo} />
      </div>
      <div className="meta-line">
        <span>Email: {patient.emailNotification.status}</span>
        <span>{patient.updatedAt?.toDate().toLocaleDateString() ?? "New"}</span>
      </div>
    </Link>
  );
}

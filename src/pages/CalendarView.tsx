import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DEFAULT_SETTINGS } from "../constants";
import { subscribePatients } from "../services/patientService";
import { subscribeSettings } from "../services/settingsService";
import type { AppSettings, CustomAssayWorkflow, Patient, PatientWorkflow, WorkflowStepTemplate } from "../types";
import { buildWorkflowSteps } from "../utils/workflow";

type CalendarMode = "Day" | "Week" | "Month" | "List";

interface CalendarEvent {
  id: string;
  date: string;
  patientId: string;
  patientDocId: string;
  assay: string;
  analyst: string;
  status: string;
}

export function CalendarView() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<CalendarMode>("Month");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [patientFilter, setPatientFilter] = useState("All");
  const [assayFilter, setAssayFilter] = useState("All");
  const [analystFilter, setAnalystFilter] = useState("All");

  useEffect(() => subscribePatients(setPatients), []);
  useEffect(() => subscribeSettings(setSettings), []);

  const workflowSteps = useMemo(() => buildWorkflowSteps(settings.workflowSteps, settings.assayTemplates), [settings]);
  const events = useMemo(() => patients.flatMap((patient) => getPatientEvents(patient, workflowSteps)), [patients, workflowSteps]);
  const assayOptions = useMemo(() => Array.from(new Set([...workflowSteps.map((step) => step.name), ...events.map((event) => event.assay)])).sort(), [events, workflowSteps]);
  const filteredEvents = useMemo(() => {
    return events.filter((event) =>
      (patientFilter === "All" || event.patientDocId === patientFilter)
      && (assayFilter === "All" || event.assay === assayFilter)
      && (analystFilter === "All" || event.analyst === analystFilter)
    );
  }, [events, patientFilter, assayFilter, analystFilter]);

  const visibleEvents = useMemo(() => filterByMode(filteredEvents, selectedDate, mode), [filteredEvents, selectedDate, mode]);

  return (
    <main className="page stack">
      <section className="panel calendar-toolbar">
        <div className="segmented">
          {(["Day", "Week", "Month", "List"] as CalendarMode[]).map((item) => (
            <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)} type="button">{item}</button>
          ))}
        </div>
        <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        <select value={patientFilter} onChange={(event) => setPatientFilter(event.target.value)}>
          <option value="All">All patients</option>
          {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.patientId}</option>)}
        </select>
        <select value={assayFilter} onChange={(event) => setAssayFilter(event.target.value)}>
          <option>All</option>
          {assayOptions.map((assay) => <option key={assay}>{assay}</option>)}
        </select>
        <select value={analystFilter} onChange={(event) => setAnalystFilter(event.target.value)}>
          <option>All</option>
          {settings.assignees.map((analyst) => <option key={analyst}>{analyst}</option>)}
        </select>
      </section>

      {mode === "Month" ? (
        <MonthCalendar selectedDate={selectedDate} events={filteredEvents} />
      ) : (
        <section className="panel">
          <div className="section-heading">
            <h2>{mode} View</h2>
            <span className="muted">{visibleEvents.length} scheduled event{visibleEvents.length === 1 ? "" : "s"}</span>
          </div>
          <EventList events={visibleEvents} />
        </section>
      )}
    </main>
  );
}

function getPatientEvents(patient: Patient, workflowSteps: WorkflowStepTemplate[]): CalendarEvent[] {
  const customById = new Map((patient.customAssays ?? []).map((assay) => [assay.id, assay]));
  const workflowEvents = workflowSteps.flatMap((step) => {
    const item = getWorkflowItem(patient.workflow, customById, step);
    const date = getScheduleDate(item);
    if (!item || !date) return [];
    return [{
      id: `${patient.id}-${step.id}`,
      date,
      patientId: patient.patientId,
      patientDocId: patient.id,
      assay: step.name,
      analyst: item.assignedTo,
      status: item.status
    }];
  });
  const additionalEvents = (patient.additionalAssays ?? []).flatMap((assay) => {
    if (!assay.scheduledDate) return [];
    return [{
      id: `${patient.id}-additional-${assay.id}`,
      date: assay.scheduledDate,
      patientId: patient.patientId,
      patientDocId: patient.id,
      assay: assay.name,
      analyst: assay.assignedTo,
      status: assay.status
    }];
  });
  return [...workflowEvents, ...additionalEvents];
}

function getWorkflowItem(workflow: PatientWorkflow, customById: Map<string, CustomAssayWorkflow>, step: WorkflowStepTemplate) {
  if (step.type === "custom") return customById.get(step.id);
  if (step.id === "phenotyping") return workflow.phenotyping;
  if (step.id === "requestCells") return workflow.requestCells;
  if (step.id === "xCelligence") return workflow.xCelligence;
  if (step.id === "elisa") return workflow.elisa;
  if (step.id === "report") return workflow.report;
  return undefined;
}

function getScheduleDate(item?: { scheduledDate?: string | null; performedDate?: string | null; requestedDate?: string | null }) {
  return item?.scheduledDate ?? item?.performedDate ?? item?.requestedDate ?? "";
}

function filterByMode(events: CalendarEvent[], selectedDate: string, mode: CalendarMode) {
  const selected = parseDateKey(selectedDate);
  if (mode === "List") return [...events].sort((a, b) => a.date.localeCompare(b.date));
  if (mode === "Day") return events.filter((event) => event.date === selectedDate);
  if (mode === "Week") {
    const start = startOfWeek(selected);
    const end = addDays(start, 6);
    return events.filter((event) => {
      const date = parseDateKey(event.date);
      return date >= start && date <= end;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }
  return events.filter((event) => event.date.startsWith(selectedDate.slice(0, 7))).sort((a, b) => a.date.localeCompare(b.date));
}

function MonthCalendar({ selectedDate, events }: { selectedDate: string; events: CalendarEvent[] }) {
  const selected = parseDateKey(selectedDate);
  const first = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const gridStart = addDays(first, -first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));

  return (
    <section className="calendar-month">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="calendar-weekday">{day}</div>)}
      {days.map((day) => {
        const key = dateKey(day);
        const dayEvents = events.filter((event) => event.date === key);
        return (
          <div key={key} className={`calendar-day ${day.getMonth() === selected.getMonth() ? "" : "muted-day"}`}>
            <strong>{day.getDate()}</strong>
            <div className="calendar-event-stack">
              {dayEvents.slice(0, 3).map((event) => <CalendarEventPill key={event.id} event={event} />)}
              {dayEvents.length > 3 && <span className="more-events">+{dayEvents.length - 3} more</span>}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function EventList({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return <p className="empty">No scheduled workflow events match these filters.</p>;
  return (
    <div className="calendar-list">
      {events.map((event) => (
        <Link to={`/patients/${event.patientDocId}`} className="calendar-list-item" key={event.id}>
          <span>{formatDate(event.date)}</span>
          <strong>{event.patientId}</strong>
          <span>{event.assay}</span>
          <span>{event.analyst}</span>
          <span>{event.status}</span>
        </Link>
      ))}
    </div>
  );
}

function CalendarEventPill({ event }: { event: CalendarEvent }) {
  return (
    <Link to={`/patients/${event.patientDocId}`} className="calendar-pill">
      <span>{event.patientId}</span>
      <small>{event.assay} - {event.analyst}</small>
    </Link>
  );
}

function todayKey() {
  return dateKey(new Date());
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  return addDays(date, -date.getDay());
}

function formatDate(value: string) {
  return parseDateKey(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

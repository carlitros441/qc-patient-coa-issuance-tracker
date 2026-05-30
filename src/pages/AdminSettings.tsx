import type { User } from "firebase/auth";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { DEFAULT_SETTINGS } from "../constants";
import { saveSettings, subscribeSettings } from "../services/settingsService";
import type { AppSettings, WorkflowStepTemplate } from "../types";
import { assayIdFromName, buildWorkflowSteps } from "../utils/workflow";

export function AdminSettings({ user }: { user: User }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState("");
  const [newProject, setNewProject] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newWorkflowStep, setNewWorkflowStep] = useState("");

  useEffect(() => subscribeSettings(setSettings), []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await saveSettings(settings, user.uid);
    setMessage("Settings saved.");
    window.setTimeout(() => setMessage(""), 2500);
  }

  return (
    <main className="page">
      <section className="panel form-panel wide">
        <div className="section-heading">
          <p className="eyebrow">Admin controls</p>
          <h2>Settings</h2>
        </div>
        <form className="stack" onSubmit={handleSubmit}>
          <label>
            Default email recipients
            <textarea
              rows={3}
              value={settings.emailRecipients.join("\n")}
              onChange={(event) => setSettings({ ...settings, emailRecipients: event.target.value.split(/\n|,/).map((item) => item.trim()).filter(Boolean) })}
            />
          </label>
          <label>
            Projects
            <EditableList
              values={settings.projects}
              newValue={newProject}
              newPlaceholder="Add project"
              onNewValue={setNewProject}
              onChange={(projects) => setSettings({ ...settings, projects })}
              onAdd={() => {
                if (!newProject.trim()) return;
                setSettings({ ...settings, projects: uniqueList([...settings.projects, newProject]) });
                setNewProject("");
              }}
            />
          </label>
          <label>
            Assignees
            <EditableList
              values={settings.assignees}
              newValue={newAssignee}
              newPlaceholder="Add assignee"
              onNewValue={setNewAssignee}
              onChange={(assignees) => setSettings({ ...settings, assignees })}
              onAdd={() => {
                if (!newAssignee.trim()) return;
                setSettings({ ...settings, assignees: uniqueList([...settings.assignees, newAssignee]) });
                setNewAssignee("");
              }}
            />
          </label>
          <label>
            Workflow assays and steps
            <WorkflowStepList
              steps={settings.workflowSteps}
              newValue={newWorkflowStep}
              onNewValue={setNewWorkflowStep}
              onChange={(workflowSteps) => setSettings({ ...settings, workflowSteps, assayTemplates: workflowSteps.filter((step) => step.type === "custom").map((step) => step.name) })}
              onAdd={() => {
                const name = newWorkflowStep.trim();
                if (!name) return;
                const customStep = { id: assayIdFromName(name), name, type: "custom" as const };
                const workflowSteps = buildWorkflowSteps([...settings.workflowSteps, customStep]);
                setSettings({ ...settings, workflowSteps, assayTemplates: workflowSteps.filter((step) => step.type === "custom").map((step) => step.name) });
                setNewWorkflowStep("");
              }}
            />
          </label>
          <label>
            Email template
            <textarea rows={12} value={settings.emailTemplate} onChange={(event) => setSettings({ ...settings, emailTemplate: event.target.value })} />
          </label>
          <label>
            User roles
            <textarea
              rows={5}
              placeholder="uid=Admin"
              value={Object.entries(settings.userRoles ?? {}).map(([uid, role]) => `${uid}=${role}`).join("\n")}
              onChange={(event) => {
                const roles = Object.fromEntries(event.target.value.split("\n").map((line) => line.split("=")).filter(([uid, role]) => uid && role));
                setSettings({ ...settings, userRoles: roles });
              }}
            />
          </label>
          {message && <p className="success">{message}</p>}
          <button className="primary" type="submit"><Save size={18} />Save settings</button>
        </form>
      </section>
    </main>
  );
}

function WorkflowStepList({
  steps,
  newValue,
  onNewValue,
  onChange,
  onAdd
}: {
  steps: WorkflowStepTemplate[];
  newValue: string;
  onNewValue: (value: string) => void;
  onChange: (steps: WorkflowStepTemplate[]) => void;
  onAdd: () => void;
}) {
  function update(nextSteps: WorkflowStepTemplate[]) {
    onChange(buildWorkflowSteps(nextSteps));
  }

  return (
    <div className="workflow-step-list">
      {steps.map((step, index) => (
        <div className="workflow-step-row" key={step.id}>
          <span className="step-order">{index + 1}</span>
          <input
            value={step.name}
            onChange={(event) => update(steps.map((candidate) => candidate.id === step.id ? { ...candidate, name: event.target.value } : candidate))}
          />
          <span className="step-kind">{step.type === "core" ? "Required" : "Custom"}</span>
          <button className="icon-button" type="button" aria-label={`Move ${step.name} up`} disabled={index === 0} onClick={() => update(moveItem(steps, index, index - 1))}>
            <ArrowUp size={16} />
          </button>
          <button className="icon-button" type="button" aria-label={`Move ${step.name} down`} disabled={index === steps.length - 1} onClick={() => update(moveItem(steps, index, index + 1))}>
            <ArrowDown size={16} />
          </button>
          <button className="icon-button" type="button" aria-label={`Remove ${step.name}`} disabled={step.type === "core"} onClick={() => update(steps.filter((candidate) => candidate.id !== step.id))}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <div className="workflow-step-row add-step-row">
        <span className="step-order">+</span>
        <input value={newValue} placeholder="Add workflow assay or step" onChange={(event) => onNewValue(event.target.value)} />
        <span className="step-kind">Custom</span>
        <button className="icon-button" type="button" aria-label="Add workflow step" onClick={onAdd}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function uniqueList(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function EditableList({
  values,
  newValue,
  newPlaceholder,
  onNewValue,
  onChange,
  onAdd
}: {
  values: string[];
  newValue: string;
  newPlaceholder: string;
  onNewValue: (value: string) => void;
  onChange: (values: string[]) => void;
  onAdd: () => void;
}) {
  return (
    <div className="editable-list">
      {values.map((value, index) => (
        <div className="editable-row" key={`${value}-${index}`}>
          <input
            value={value}
            onChange={(event) => onChange(uniqueList(values.map((item, itemIndex) => itemIndex === index ? event.target.value : item)))}
          />
          <button className="icon-button" type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <div className="editable-row">
        <input value={newValue} placeholder={newPlaceholder} onChange={(event) => onNewValue(event.target.value)} />
        <button className="icon-button" type="button" aria-label={newPlaceholder} onClick={onAdd}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

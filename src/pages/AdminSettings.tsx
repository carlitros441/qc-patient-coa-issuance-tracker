import type { User } from "firebase/auth";
import { Plus, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { DEFAULT_SETTINGS } from "../constants";
import { saveSettings, subscribeSettings } from "../services/settingsService";
import type { AppSettings } from "../types";

export function AdminSettings({ user }: { user: User }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState("");
  const [newProject, setNewProject] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newAssay, setNewAssay] = useState("");

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
            Additional workflow assays
            <EditableList
              values={settings.assayTemplates ?? []}
              newValue={newAssay}
              newPlaceholder="Add assay after Report"
              onNewValue={setNewAssay}
              onChange={(assayTemplates) => setSettings({ ...settings, assayTemplates })}
              onAdd={() => {
                if (!newAssay.trim()) return;
                setSettings({ ...settings, assayTemplates: uniqueList([...(settings.assayTemplates ?? []), newAssay]) });
                setNewAssay("");
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

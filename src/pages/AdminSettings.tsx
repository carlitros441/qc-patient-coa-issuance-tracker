import type { User } from "firebase/auth";
import { Save } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { DEFAULT_SETTINGS } from "../constants";
import { saveSettings, subscribeSettings } from "../services/settingsService";
import type { AppSettings } from "../types";

export function AdminSettings({ user }: { user: User }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [message, setMessage] = useState("");

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
            <textarea
              rows={3}
              value={settings.projects.join("\n")}
              onChange={(event) => setSettings({ ...settings, projects: event.target.value.split(/\n|,/).map((item) => item.trim()).filter(Boolean) })}
            />
          </label>
          <label>
            Assignees
            <textarea
              rows={3}
              value={settings.assignees.join("\n")}
              onChange={(event) => setSettings({ ...settings, assignees: event.target.value.split(/\n|,/).map((item) => item.trim()).filter(Boolean) })}
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

import type { User } from "firebase/auth";
import { Save } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPatient } from "../services/patientService";
import { subscribeSettings } from "../services/settingsService";
import type { AppSettings } from "../types";

export function AddPatient({ user }: { user: User }) {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [patientId, setPatientId] = useState("");
  const [project, setProject] = useState("Co-Exist");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribeSettings(setSettings), []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const ref = await createPatient({ patientId, project, notes, userId: user.uid });
      navigate(`/patients/${ref.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add patient.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page">
      <section className="panel form-panel">
        <div className="section-heading">
          <p className="eyebrow">New coded record</p>
          <h2>Add Patient</h2>
        </div>
        <form className="stack" onSubmit={handleSubmit}>
          <label>
            Patient ID or Patient Code
            <input value={patientId} onChange={(event) => setPatientId(event.target.value)} placeholder="PT-001" required />
          </label>
          <label>
            Project
            <select value={project} onChange={(event) => setProject(event.target.value)}>
              {(settings?.projects ?? ["Co-Exist", "CARE"]).map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional non-PHI notes" rows={4} />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit" disabled={saving}><Save size={18} />{saving ? "Saving..." : "Save patient"}</button>
        </form>
      </section>
    </main>
  );
}

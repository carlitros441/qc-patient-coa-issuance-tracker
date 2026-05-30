import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { ClipboardCheck, Home, LogOut, PlusCircle, Settings, Sparkles } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { auth } from "./firebase";
import { isFirebaseConfigured, missingFirebaseEnv } from "./firebase";
import { AdminSettings } from "./pages/AdminSettings";
import { AddPatient } from "./pages/AddPatient";
import { Dashboard } from "./pages/Dashboard";
import { PatientDetail } from "./pages/PatientDetail";

export interface AuthContextValue {
  user: User;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="cat-mark" aria-hidden="true" />
        <p className="eyebrow">QC Laboratory</p>
        <h1>QC Patient CoA Issuance Tracker</h1>
        <form onSubmit={handleSubmit} className="stack">
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
          </label>
          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
          </label>
          {error && <p className="error">{error}</p>}
          <button disabled={loading} className="primary" type="submit">
            <ClipboardCheck size={18} />
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Shell({ user }: AuthContextValue) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon"><Sparkles size={20} /></span>
          <span>Patient Tracker</span>
        </div>
        <nav>
          <NavLink to="/"><Home size={18} />Dashboard</NavLink>
          <NavLink to="/patients/new"><PlusCircle size={18} />Add Patient</NavLink>
          <NavLink to="/admin"><Settings size={18} />Admin Settings</NavLink>
        </nav>
        <button className="ghost logout" onClick={() => signOut(auth)}><LogOut size={18} />Sign out</button>
      </aside>
      <div className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Pastel QC workspace</p>
            <h1>Patient CoA Issuance</h1>
          </div>
          <div className="user-chip">{user.email}</div>
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients/new" element={<AddPatient user={user} />} />
          <Route path="/patients/:id" element={<PatientDetail user={user} />} />
          <Route path="/admin" element={<AdminSettings user={user} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setReady(true);
      return;
    }
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setReady(true);
    });
  }, []);

  if (!ready) return <div className="loading">Loading tracker...</div>;
  if (!isFirebaseConfigured) return <FirebaseSetupNotice />;
  return user ? <Shell user={user} /> : <Login />;
}

function FirebaseSetupNotice() {
  return (
    <main className="login-shell">
      <section className="login-panel setup-panel">
        <div className="cat-mark" aria-hidden="true" />
        <p className="eyebrow">Setup needed</p>
        <h1>Firebase config is missing</h1>
        <p className="muted">
          Create a <code>.env</code> file from <code>.env.example</code>, fill in your Firebase web app values, then restart the Vite server.
        </p>
        <div className="missing-list">
          {missingFirebaseEnv.map((key) => <code key={key}>{key}</code>)}
        </div>
      </section>
    </main>
  );
}

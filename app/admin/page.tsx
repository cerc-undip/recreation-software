"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Participant = {
  id: string;
  username: string;
  token: string | null;
  joinedAt: string | null;
  isActive: boolean;
  isBlacklisted: boolean;
};

type SessionData = {
  id: string;
  code: string;
  status: "waiting" | "active" | "ended";
  currentProblemIndex: number;
  currentProblemStartedAt: string | null;
  participants: Participant[];
  problemLinks: { id: string; order: number; problem: { id: string; title: string } }[];
};

type Envelope<T> = { success: boolean; data?: T; error?: string };

async function api<T>(url: string, body?: unknown): Promise<Envelope<T>> {
  try {
    const init: RequestInit = { method: "GET", cache: "no-store" };
    if (body !== undefined) {
      init.method = "POST";
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);
    return (await res.json()) as Envelope<T>;
  } catch {
    return { success: false, error: "Network error" };
  }
}

export default function AdminDashboard() {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [manualName, setManualName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;

  const loadSessions = useCallback(async () => {
    const res = await api<SessionData[]>("/api/admin/session");
    if (res.success && res.data) {
      setSessions(res.data);
      setSelectedId((prev) => prev ?? res.data?.[0]?.id ?? null);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSessions();
  }, [loadSessions]);

  const refresh = useCallback(async () => {
    setBusy(true);
    await loadSessions();
    setBusy(false);
  }, [loadSessions]);

  const run = async (fn: () => Promise<Envelope<unknown>>, okMsg: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fn();
    await loadSessions();
    setBusy(false);
    if (res.success) {
      setMessage(okMsg);
    } else {
      setError(res.error ?? "Request failed");
    }
    return res;
  };

  const createSession = () =>
    run(() => api<SessionData>("/api/admin/session", {}), "Session created");

  const addManual = (e: React.FormEvent) => {
    e.preventDefault();
    const username = manualName.trim();
    if (!username || !selected) return;
    void run(async () => {
      const res = await api(`/api/admin/session/${selected.id}/participants`, { usernames: [username] });
      if (res.success) setManualName("");
      return res;
    }, `Added ${username}`);
  };

  const addBulk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim() || !selected) return;
    void run(async () => {
      const res = await api(`/api/admin/session/${selected.id}/participants`, { text: bulkText });
      if (res.success) setBulkText("");
      return res;
    }, "Blacklist imported");
  };

  const addCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    const text = await file.text();
    await run(() => api(`/api/admin/session/${selected.id}/participants`, { text }), "CSV imported");
    if (fileRef.current) fileRef.current.value = "";
  };

  const lifecycle = (action: "start" | "next" | "end") => {
    if (!selected) return;
    void run(
      () => api(`/api/admin/session/${selected.id}/${action}`, {}),
      `Session ${action === "end" ? "ended" : action === "start" ? "started" : "advanced"}`,
    );
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">CodeArena Admin</h1>
          <div className="flex gap-2">
            <a
              href="/admin/leaderboard"
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-100"
            >
              Leaderboard
            </a>
            <Button variant="outline" onClick={() => void refresh()} disabled={busy}>
              {busy ? "Working..." : "Refresh"}
            </Button>
          </div>
        </header>

        {message && <div className="rounded bg-green-100 p-2 text-sm text-green-800">{message}</div>}
        {error && <div className="rounded bg-red-100 p-2 text-sm text-red-800">{error}</div>}

        <section className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div>
            <h2 className="font-semibold">Sessions</h2>
            <p className="text-sm text-gray-500">Create a session; it links all 3 seeded problems in order.</p>
          </div>
          <Button onClick={() => void createSession()} disabled={busy}>
            Create Session
          </Button>
        </section>

        {sessions.length > 0 && (
          <section className="flex flex-wrap gap-2">
            {sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  s.id === selectedId
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : "border-gray-300 bg-white hover:bg-gray-100"
                }`}
              >
                <span className="font-mono font-bold">{s.code}</span>
                <span className="ml-2 text-gray-500">{s.status}</span>
              </button>
            ))}
          </section>
        )}

        {selected && (
          <>
            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded bg-gray-100 px-2 py-1 font-mono text-lg font-bold tracking-widest">
                  {selected.code}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    selected.status === "active"
                      ? "bg-green-100 text-green-800"
                      : selected.status === "waiting"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-200 text-gray-800"
                  }`}
                >
                  {selected.status.toUpperCase()}
                </span>
                <span className="text-sm text-gray-500">
                  Problem {Math.min(selected.currentProblemIndex + 1, selected.problemLinks.length)} of{" "}
                  {selected.problemLinks.length}
                </span>
              </div>
              <ol className="mt-3 list-inside list-decimal text-sm text-gray-600">
                {selected.problemLinks
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((link) => (
                    <li key={link.id}>{link.problem.title}</li>
                  ))}
              </ol>
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={() => lifecycle("start")}
                  disabled={busy || selected.status !== "waiting"}
                >
                  Start Session
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => lifecycle("next")}
                  disabled={busy || selected.status !== "active" || selected.currentProblemIndex + 1 >= selected.problemLinks.length}
                >
                  Next Problem
                </Button>
                <Button variant="destructive" onClick={() => lifecycle("end")} disabled={busy || selected.status !== "active"}>
                  End Session
                </Button>
              </div>
            </section>

            <section className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold">Blacklist</h2>

              <form onSubmit={addManual} className="flex gap-2">
                <input
                  className="flex-1 rounded border border-gray-300 bg-white p-2 text-sm"
                  placeholder="Username"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  disabled={busy}
                />
                <Button type="submit" size="sm" disabled={busy || !manualName.trim()}>
                  Add
                </Button>
              </form>

              <form onSubmit={addBulk} className="flex flex-col gap-2">
                <textarea
                  className="h-24 rounded border border-gray-300 bg-white p-2 text-sm"
                  placeholder={"One username per line, or CSV text (username column)"}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  disabled={busy}
                />
                <div className="flex items-center gap-2">
                  <Button type="submit" size="sm" variant="secondary" disabled={busy || !bulkText.trim()}>
                    Import Text / CSV
                  </Button>
                  <label className="text-sm text-gray-500">
                    or upload CSV:{" "}
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv,text/csv,text/plain"
                      className="text-sm text-gray-500"
                      onChange={(e) => void addCsvFile(e)}
                      disabled={busy}
                    />
                  </label>
                </div>
              </form>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-600">
                  Blacklisted ({selected.participants.filter((p) => p.isBlacklisted).length})
                </h3>
                {selected.participants.filter((p) => p.isBlacklisted).length === 0 ? (
                  <p className="text-sm text-gray-500">No blacklisted usernames yet.</p>
                ) : (
                  <ul className="flex max-h-48 flex-wrap gap-2 overflow-auto text-sm">
                    {selected.participants.filter((p) => p.isBlacklisted).map((p) => (
                      <li
                        key={p.id}
                        className="rounded border border-red-200 bg-red-50 px-2 py-1 text-red-800"
                      >
                        {p.username}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

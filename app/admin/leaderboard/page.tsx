"use client";

import { useEffect, useState } from "react";

type Entry = {
  username: string;
  totalScore: number;
};

export default function AdminLeaderboardPage() {
  const [sessions, setSessions] = useState<{ id: string; code: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const loadSessions = async () => {
      const res = await fetch("/api/admin/session", { cache: "no-store" });
      const data = await res.json();
      if (data.success && data.data) {
        setSessions(data.data);
        setSelectedId(data.data[0]?.id ?? null);
      }
    };
    void loadSessions();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const load = async () => {
      const res = await fetch(`/api/admin/session/${selectedId}/leaderboard`, { cache: "no-store" });
      const data = await res.json();
      if (data.success) setEntries(data.data.leaderboard);
    };
    void load();
    const id = setInterval(() => void load(), 2500);
    return () => clearInterval(id);
  }, [selectedId]);

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin Leaderboard</h1>
          <select
            className="rounded border border-gray-300 bg-white p-2 text-sm"
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.code}</option>
            ))}
          </select>
        </header>

        {selectedId && (
          <div className="mb-4">
            <a
              href={`/api/admin/session/${selectedId}/export`}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              download
            >
              Export CSV
            </a>
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="pb-2">Rank</th>
                <th className="pb-2">Username</th>
                <th className="pb-2 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={entry.username} className="border-b border-gray-100">
                  <td className="py-2">{index + 1}</td>
                  <td className="py-2 font-semibold">{entry.username}</td>
                  <td className="py-2 text-right font-mono">{entry.totalScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

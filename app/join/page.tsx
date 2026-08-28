"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionCode: code, username }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem("codearena_token", data.data.token);
        router.push("/play");
      } else {
        setError(data.error || "Failed to join");
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4 text-gray-900">
      <form onSubmit={handleJoin} className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-xl">
        <h1 className="text-center text-2xl font-bold">Join CodeArena</h1>
        
        {error && <div className="rounded bg-red-100 p-2 text-sm text-red-800">{error}</div>}

        <div className="flex flex-col gap-1">
          <label htmlFor="code" className="text-sm font-medium text-gray-600">Session Code</label>
          <input
            id="code"
            className="rounded border border-gray-300 bg-white p-2 font-mono uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            disabled={busy}
            maxLength={6}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="username" className="text-sm font-medium text-gray-600">Username</label>
          <input
            id="username"
            className="rounded border border-gray-300 bg-white p-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={busy}
          />
        </div>

        <Button type="submit" disabled={busy || !code || !username} className="mt-2">
          {busy ? "Joining..." : "Join"}
        </Button>
      </form>
    </main>
  );
}

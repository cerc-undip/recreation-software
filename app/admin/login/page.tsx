"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Login failed");
      } else {
        router.push("/admin");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-md bg-white p-6 shadow-md w-80">
        <h1 className="text-xl font-bold">Admin Login</h1>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <input
          className="rounded border p-2 text-black"
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
          autoFocus
        />
        <input
          className="rounded border p-2 text-black"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
        <button
          className="rounded bg-blue-600 p-2 text-white disabled:opacity-50"
          type="submit"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

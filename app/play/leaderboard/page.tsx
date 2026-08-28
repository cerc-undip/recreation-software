"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const AmbientBackground = dynamic(() => import("@/components/three/AmbientBackground"), { ssr: false });
const ConfettiEffect = dynamic(() => import("@/components/three/ConfettiEffect"), { ssr: false });

function headers(): HeadersInit {
  return { Authorization: `Bearer ${localStorage.getItem("codearena_token") ?? ""}` };
}

type Entry = {
  username: string;
  totalScore: number;
  earliestFullAcAt: string | null;
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/leaderboard", { headers: headers(), cache: "no-store" });
      if (res.status === 401) {
        router.push("/join");
        return;
      }
      const data = await res.json();
      if (data.success) setEntries(data.data.leaderboard);
      else setError(data.error ?? "Failed to load leaderboard");

      const stateRes = await fetch("/api/session/state", { headers: headers(), cache: "no-store" });
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        if (stateData.success && stateData.data.status === "ended") {
          setEnded(true);
        }
      }
    };
    void load();
    const id = setInterval(() => void load(), 2500);
    return () => clearInterval(id);
  }, [router]);

  return (
    <main className="relative min-h-screen p-6 text-gray-900">
      <AmbientBackground />
      {ended && <ConfettiEffect />}
      <section className="relative z-10 mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <h1 className="mb-6 text-center text-3xl font-bold">Leaderboard</h1>
        {error && <div className="mb-4 rounded bg-red-100 p-2 text-sm text-red-800">{error}</div>}
        <ol className="flex flex-col gap-2">
          {entries.map((entry, index) => (
            <li key={entry.username} className="flex items-center justify-between rounded-lg bg-gray-100 p-3">
              <div className="flex items-center gap-3">
                <span className="w-8 text-xl font-black text-blue-600">#{index + 1}</span>
                <span className="font-semibold">{entry.username}</span>
              </div>
              <span className="font-mono text-lg font-bold">{entry.totalScore}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

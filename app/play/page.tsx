"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
const AmbientBackground = dynamic(() => import("@/components/three/AmbientBackground"), { ssr: false });
const TransitionEffect = dynamic(() => import("@/components/three/TransitionEffect"), { ssr: false });

type Problem = {
  id: string;
  title: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
  starterCode: string | null;
  timeLimitMs: number;
  points: number;
};

type SessionState = {
  status: "waiting" | "active" | "ended";
  currentProblemIndex: number;
  currentProblemId: string | null;
  totalProblems: number;
};

type SubmitResult = {
  status: string;
  testCasesPassed: number;
  totalTestCases: number;
  isRunOnly: boolean;
  results: { testCaseId: string; status: string; isSample: boolean; actualOutput: string | null }[];
};

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("codearena_token");
  return { Authorization: `Bearer ${token ?? ""}` };
}

export default function PlayPage() {
  const router = useRouter();
  const [state, setState] = useState<SessionState | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [code, setCode] = useState<string>("");
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transition, setTransition] = useState(false);
  const lastProblemIdRef = useRef<string | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    try {
      const stateRes = await fetch("/api/session/state", { headers: authHeaders(), cache: "no-store" });
      if (stateRes.status === 401) {
        router.push("/join");
        return;
      }
      const stateData = await stateRes.json();
      if (!stateData.success) return;
      setState(stateData.data);

      if (stateData.data.status === "active" && stateData.data.currentProblemId) {
        const probRes = await fetch("/api/problem/current", { headers: authHeaders(), cache: "no-store" });
        const probData = await probRes.json();
        if (probData.success && probData.data.problem) {
          setProblem(probData.data.problem);
          if (lastProblemIdRef.current !== probData.data.problem.id) {
            const isFirst = lastProblemIdRef.current === null;
            lastProblemIdRef.current = probData.data.problem.id;
            setCode(probData.data.problem.starterCode ?? "");
            setResult(null);
            if (!isFirst) {
              setTransition(true);
              if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
              transitionTimerRef.current = setTimeout(() => setTransition(false), 1200);
            }
          }
        }
      } else {
        setProblem(null);
      }
    } catch {
      // transient network error; next poll retries
    }
  }, [router]);

  useEffect(() => {
    if (!localStorage.getItem("codearena_token")) {
      router.push("/join");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void poll();
    const interval = setInterval(() => void poll(), 2500);
    return () => {
      clearInterval(interval);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    };
  }, [poll, router]);

  const submit = async (isRunOnly: boolean) => {
    if (!problem) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem.id, code, isRunOnly }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.error ?? "Submission failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return <main className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-900">Loading...</main>;
  }

  if (state.status === "waiting") {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center gap-4 text-gray-900">
        <AmbientBackground />
        <h1 className="relative z-10 text-3xl font-bold">Waiting for admin to start...</h1>
        <p className="relative z-10 animate-pulse text-gray-500">You are in the lobby. The problem will appear automatically.</p>
      </main>
    );
  }

  if (state.status === "ended") {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center gap-4 text-gray-900">
        <AmbientBackground />
        <h1 className="relative z-10 text-3xl font-bold">Session ended</h1>
        <Button className="relative z-10" onClick={() => router.push("/play/leaderboard")}>View Final Leaderboard</Button>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen p-4 text-gray-900">
      <AmbientBackground />
      <TransitionEffect show={transition} />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-4">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{problem?.title ?? "Loading problem..."}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>Problem {state.currentProblemIndex + 1} / {state.totalProblems}</span>
            <span>{problem?.points} pts</span>
            <span>{problem?.timeLimitMs ? problem.timeLimitMs / 1000 : 5}s limit</span>
          </div>
        </header>

        {error && <div className="rounded bg-red-100 p-2 text-sm text-red-800">{error}</div>}

        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="flex flex-col gap-3 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div>
              <h2 className="mb-1 font-semibold text-blue-600">Description</h2>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{problem?.description}</p>
            </div>
            <div>
              <h2 className="mb-1 font-semibold text-blue-600">Input Format</h2>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{problem?.inputFormat}</p>
            </div>
            <div>
              <h2 className="mb-1 font-semibold text-blue-600">Output Format</h2>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{problem?.outputFormat}</p>
            </div>
            <div>
              <h2 className="mb-1 font-semibold text-blue-600">Constraints</h2>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{problem?.constraints}</p>
            </div>
            <div>
              <h2 className="mb-1 font-semibold text-blue-600">Sample</h2>
              <pre className="rounded bg-gray-100 p-2 text-xs text-gray-800">{`Input:\n${problem?.sampleInput}\n\nOutput:\n${problem?.sampleOutput}`}</pre>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="h-80 flex-1 overflow-hidden rounded border border-gray-200">
              <MonacoEditor
                language="python"
                theme="vs"
                value={code}
                onChange={(v) => setCode(v ?? "")}
                options={{ minimap: { enabled: false }, fontSize: 13 }}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => void submit(true)} disabled={busy}>
                {busy ? "Running..." : "Run (Sample)"}
              </Button>
              <Button onClick={() => void submit(false)} disabled={busy}>
                {busy ? "Submitting..." : "Submit"}
              </Button>
            </div>

            {result && (
              <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 font-bold ${
                      result.status === "AC"
                        ? "bg-green-100 text-green-800"
                        : result.status === "WA"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {result.status}
                  </span>
                  <span className="text-gray-600">
                    {result.testCasesPassed}/{result.totalTestCases} test cases passed
                    {result.isRunOnly ? " (run only, not scored)" : ""}
                  </span>
                </div>
                {result.results.map((r) => (
                  <div key={r.testCaseId} className="flex items-center gap-2 border-t border-gray-100 py-1">
                    <span className="w-10 font-mono text-xs">{r.status}</span>
                    {r.actualOutput && <pre className="max-h-20 overflow-auto text-xs text-gray-600">{r.actualOutput}</pre>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

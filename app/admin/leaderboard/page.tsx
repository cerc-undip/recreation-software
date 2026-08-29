"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";

const InteractivePointsBackground = dynamic(() => import("@/components/three/InteractivePointsBackground"), { ssr: false });

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
    <main className="relative min-h-screen p-6 text-gray-100">
      <InteractivePointsBackground />
      <div className="relative z-10 mx-auto max-w-4xl">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">CERC CodeArena Leaderboard</h1>
          <Select value={selectedId ?? ""} onValueChange={setSelectedId}>
            <SelectTrigger className="w-[200px] border-white/20 bg-black/40 text-white backdrop-blur-sm">
              <SelectValue placeholder="Select Session">
                {sessions.find((s) => s.id === selectedId)?.code ?? "Select Session"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>

        {selectedId && (
          <div className="mb-6">
            <a
              href={`/api/admin/session/${selectedId}/export`}
              download
              className={buttonVariants({ variant: "default", className: "bg-blue-600 hover:bg-blue-500 text-white shadow-md hover:shadow-lg hover:shadow-blue-500/20" })}
            >
              Export CSV
            </a>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30 shadow-2xl backdrop-blur-md">
          <div className="grid grid-cols-12 gap-4 border-b border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-gray-300">
            <div className="col-span-2">Rank</div>
            <div className="col-span-7">Username</div>
            <div className="col-span-3 text-right">Total Score</div>
          </div>
          <div className="flex flex-col">
            <AnimatePresence mode="popLayout">
              {entries.map((entry, index) => {
                const isTop3 = index < 3;
                const isTop10 = index >= 3 && index < 10;
                
                let bgClass = "bg-transparent";
                let textClass = "text-gray-200";
                let rankBadge = "bg-white/5 text-gray-400 border border-white/10";
                
                if (index === 0) {
                  bgClass = "bg-yellow-500/10";
                  textClass = "text-yellow-400 font-bold";
                  rankBadge = "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.3)]";
                } else if (index === 1) {
                  bgClass = "bg-gray-300/10";
                  textClass = "text-gray-300 font-bold";
                  rankBadge = "bg-gray-400/20 text-gray-300 border border-gray-400/30 shadow-[0_0_10px_rgba(156,163,175,0.3)]";
                } else if (index === 2) {
                  bgClass = "bg-orange-500/10";
                  textClass = "text-orange-400 font-bold";
                  rankBadge = "bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.3)]";
                } else if (isTop10) {
                  bgClass = "bg-blue-500/5";
                  textClass = "text-blue-200 font-semibold";
                  rankBadge = "bg-blue-500/10 text-blue-300 border border-blue-500/20";
                }

                return (
                  <motion.div
                    key={entry.username}
                    layout
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                    transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.8 }}
                    className={`grid grid-cols-12 items-center gap-4 border-b border-white/5 px-6 py-4 transition-colors hover:bg-white/10 ${bgClass}`}
                  >
                    <div className="col-span-2 flex items-center">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${rankBadge}`}>
                        {index + 1}
                      </span>
                    </div>
                    <div className={`col-span-7 truncate text-lg ${textClass}`}>
                      {entry.username}
                      {index === 0 && <span className="ml-2 inline-block animate-bounce text-xl drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]">👑</span>}
                      {index === 1 && <span className="ml-2 inline-block text-xl drop-shadow-[0_0_8px_rgba(156,163,175,0.8)]">🥈</span>}
                      {index === 2 && <span className="ml-2 inline-block text-xl drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]">🥉</span>}
                    </div>
                    <div className={`col-span-3 text-right font-mono text-lg ${isTop3 ? "font-bold" : "font-medium"}`}>
                      {entry.totalScore}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {entries.length === 0 && (
              <div className="p-8 text-center text-gray-400">No participants yet.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/Card";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import { StateBadge } from "@/components/StateBadge";
import { SESSION_STATE_STYLES, type SessionState } from "@/lib/design-tokens";

interface DashboardSession {
  id: string;
  state: SessionState;
  task: { title: string };
  result: { confidenceScore: number; reasons: string[] } | null;
}

const FLASH_DURATION_MS = 1600;

export default function DashboardPage() {
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set());
  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    fetch("/api/dashboard/sessions")
      .then((res) => res.json())
      .then((data: DashboardSession[]) => setSessions(data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/dashboard/stream");

    source.onmessage = (event: MessageEvent<string>) => {
      const updated: DashboardSession = JSON.parse(event.data);
      setSessions((prev) => {
        const index = prev.findIndex((s) => s.id === updated.id);
        if (index === -1) return [updated, ...prev];
        const next = [...prev];
        next[index] = updated;
        return next;
      });

      setFlashingIds((prev) => new Set(prev).add(updated.id));
      const existingTimer = flashTimers.current.get(updated.id);
      if (existingTimer) clearTimeout(existingTimer);
      flashTimers.current.set(
        updated.id,
        setTimeout(() => {
          setFlashingIds((prev) => {
            const next = new Set(prev);
            next.delete(updated.id);
            return next;
          });
          flashTimers.current.delete(updated.id);
        }, FLASH_DURATION_MS)
      );
    };

    return () => {
      source.close();
      // flashTimers is a plain mutable Map, not a DOM node ref, so it's safe
      // (and intentional) to read its live value here rather than a snapshot.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const timers = flashTimers.current;
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Business Dashboard</h1>
          <p className="text-sm text-slate-500">Updates live as reports are verified</p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="font-medium text-slate-900">No sessions yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Sessions will appear here once participants are assigned tasks.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className={`p-5 transition-colors ${flashingIds.has(session.id) ? "flash-highlight" : ""}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-900">
                    {session.task.title}
                  </h2>
                  <StateBadge state={session.state} />
                </div>

                {session.result ? (
                  <div className="mt-4 space-y-3">
                    <ConfidenceBar
                      score={session.result.confidenceScore}
                      colorClassName={SESSION_STATE_STYLES[session.state].accentClassName}
                    />
                    <ul className="space-y-1 text-sm text-slate-500">
                      {session.result.reasons.map((reason) => (
                        <li key={reason} className="flex gap-2">
                          <span className="text-slate-300">•</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">Not yet verified</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

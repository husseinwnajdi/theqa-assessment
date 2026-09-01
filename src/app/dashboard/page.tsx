"use client";

import { useEffect, useState } from "react";

import { SESSION_STATE_BADGE_CLASSES, type SessionState } from "@/lib/sessionStateStyles";

interface DashboardSession {
  id: string;
  state: SessionState;
  task: { title: string };
  result: { confidenceScore: number; reasons: string[] } | null;
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState<DashboardSession[]>([]);

  useEffect(() => {
    fetch("/api/dashboard/sessions")
      .then((res) => res.json())
      .then((data: DashboardSession[]) => setSessions(data));
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
    };

    return () => {
      source.close();
    };
  }, []);

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold mb-4">Business Dashboard</h1>
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 pr-4">Task</th>
            <th className="py-2 pr-4">State</th>
            <th className="py-2 pr-4">Confidence</th>
            <th className="py-2">Reasons</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id} className="border-b align-top">
              <td className="py-2 pr-4">{session.task.title}</td>
              <td className="py-2 pr-4">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${SESSION_STATE_BADGE_CLASSES[session.state]}`}
                >
                  {session.state}
                </span>
              </td>
              <td className="py-2 pr-4">
                {session.result ? `${session.result.confidenceScore}/100` : "—"}
              </td>
              <td className="py-2">
                {session.result ? (
                  <ul className="list-disc list-inside">
                    {session.result.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

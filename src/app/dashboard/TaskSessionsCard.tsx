import { Card } from "@/components/Card";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import { StateBadge } from "@/components/StateBadge";
import { SESSION_STATE_STYLES, type SessionState } from "@/lib/design-tokens";

export interface TaskSession {
  id: string;
  state: SessionState;
  participant: { name: string; email: string };
  result: { confidenceScore: number; reasons: string[] } | null;
  lastPingDistanceMeters: number | null;
  lastPingInRange: boolean | null;
}

export interface TaskWithSessions {
  id: string;
  title: string;
  description: string;
  targetLat: number;
  targetLng: number;
  radiusMeters: number;
  sessions: TaskSession[];
}

export function TaskSessionsCard({
  task,
  flashingIds,
}: {
  task: TaskWithSessions;
  flashingIds: Set<string>;
}) {
  return (
    <Card className="p-6">
      <h3 className="text-base font-semibold text-slate-900">{task.title}</h3>
      <p className="mt-1 text-sm text-slate-500">{task.description}</p>
      <p className="mt-1 text-xs text-slate-400">
        {task.targetLat}, {task.targetLng} · {task.radiusMeters}m radius
      </p>

      <div className="mt-4 border-t border-slate-100">
        {task.sessions.length === 0 ? (
          <p className="py-4 text-sm text-slate-400">No participants assigned yet</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {task.sessions.map((session) => (
              <div
                key={session.id}
                className={`flex flex-wrap items-center justify-between gap-3 py-3 transition-colors ${
                  flashingIds.has(session.id) ? "flash-highlight" : ""
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {session.participant.name}
                  </p>
                  <p className="text-xs text-slate-500">{session.participant.email}</p>
                </div>

                <div className="flex items-center gap-3">
                  {session.state === "ACTIVE" && session.lastPingDistanceMeters !== null && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                        session.lastPingInRange
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-red-200 bg-red-50 text-red-700"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          session.lastPingInRange ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      {Math.round(session.lastPingDistanceMeters)}m from target
                    </span>
                  )}
                  {session.result && (
                    <ConfidenceBar
                      score={session.result.confidenceScore}
                      colorClassName={SESSION_STATE_STYLES[session.state].accentClassName}
                    />
                  )}
                  <StateBadge state={session.state} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

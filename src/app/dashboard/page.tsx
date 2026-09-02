"use client";

import { useEffect, useRef, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/Card";
import type { SessionState } from "@/lib/design-tokens";

import { AssignableTaskCard } from "./AssignableTaskCard";
import { CreateTaskForm, type CreatedTask } from "./CreateTaskForm";
import { TaskSessionsCard, type TaskWithSessions } from "./TaskSessionsCard";

interface StreamedSession {
  id: string;
  taskId: string;
  state: SessionState;
  participant: { name: string; email: string };
  result: { confidenceScore: number; reasons: string[] } | null;
}

const FLASH_DURATION_MS = 1600;

export default function DashboardPage() {
  const [taskGroups, setTaskGroups] = useState<TaskWithSessions[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<CreatedTask[]>([]);
  const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set());
  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    fetch("/api/dashboard/tasks-with-sessions")
      .then((res) => res.json())
      .then((data: TaskWithSessions[]) => setTaskGroups(data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/dashboard/stream");

    source.onmessage = (event: MessageEvent<string>) => {
      const updated: StreamedSession = JSON.parse(event.data);
      setTaskGroups((prev) =>
        prev.map((task) => {
          if (task.id !== updated.taskId) return task;
          const index = task.sessions.findIndex((s) => s.id === updated.id);
          const nextSessions = [...task.sessions];
          if (index === -1) {
            nextSessions.unshift(updated);
          } else {
            nextSessions[index] = updated;
          }
          return { ...task, sessions: nextSessions };
        })
      );

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

        <section className="mb-10 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>
          <CreateTaskForm onCreated={(task) => setTasks((prev) => [task, ...prev])} />
          {tasks.length > 0 && (
            <div className="space-y-3">
              {tasks.map((task) => (
                <AssignableTaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </section>

        <h2 className="mb-4 text-lg font-semibold text-slate-900">Sessions</h2>

        {loading ? (
          <p className="text-sm text-slate-500">Loading sessions…</p>
        ) : taskGroups.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="font-medium text-slate-900">No tasks yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Create a task above to start assigning visits to participants.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {taskGroups.map((task) => (
              <TaskSessionsCard key={task.id} task={task} flashingIds={flashingIds} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

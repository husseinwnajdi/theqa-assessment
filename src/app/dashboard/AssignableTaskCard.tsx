"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Label } from "@/components/Label";

import type { CreatedTask } from "./CreateTaskForm";

interface AssignedLink {
  sessionId: string;
  participantEmail: string;
  link: string;
}

export function AssignableTaskCard({ task }: { task: CreatedTask }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<AssignedLink[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleAssign(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/dashboard/tasks/${task.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantEmail: email, participantName: name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const data: { sessionId: string } = await res.json();
      const link = `${window.location.origin}/session/${data.sessionId}`;
      setAssigned((prev) => [{ sessionId: data.sessionId, participantEmail: email, link }, ...prev]);
      setEmail("");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopy(sessionId: string, link: string): void {
    navigator.clipboard
      ?.writeText(link)
      .then(() => {
        setCopiedId(sessionId);
        setTimeout(() => {
          setCopiedId((current) => (current === sessionId ? null : current));
        }, 1500);
      })
      .catch(() => {
        // clipboard access denied or unavailable; the link is still selectable in the input
      });
  }

  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold text-slate-900">{task.title}</h3>
      <p className="mt-1 text-sm text-slate-500">{task.description}</p>
      <p className="mt-1 text-xs text-slate-400">
        {task.targetLat}, {task.targetLng} · {task.radiusMeters}m radius
      </p>

      <form onSubmit={handleAssign} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[160px] flex-1">
          <Label htmlFor={`assign-email-${task.id}`}>Participant email</Label>
          <Input
            id={`assign-email-${task.id}`}
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="min-w-[160px] flex-1">
          <Label htmlFor={`assign-name-${task.id}`}>Participant name</Label>
          <Input
            id={`assign-name-${task.id}`}
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Assigning…" : "Assign"}
        </Button>
      </form>

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {assigned.length > 0 && (
        <ul className="mt-4 space-y-2">
          {assigned.map((a) => (
            <li key={a.sessionId} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2.5">
              <span className="w-40 flex-shrink-0 truncate text-sm text-slate-500">
                {a.participantEmail}
              </span>
              <Input
                readOnly
                value={a.link}
                className="flex-1"
                onFocus={(event) => event.target.select()}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleCopy(a.sessionId, a.link)}
              >
                {copiedId === a.sessionId ? "Copied!" : "Copy"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

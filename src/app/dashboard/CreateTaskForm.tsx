"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Label } from "@/components/Label";
import { Textarea } from "@/components/Textarea";

export interface CreatedTask {
  id: string;
  title: string;
  description: string;
  targetLat: number;
  targetLng: number;
  radiusMeters: number;
}

export function CreateTaskForm({ onCreated }: { onCreated: (task: CreatedTask) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetLat, setTargetLat] = useState("");
  const [targetLng, setTargetLng] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          targetLat: Number(targetLat),
          targetLng: Number(targetLng),
          radiusMeters: Number(radiusMeters),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }
      const task: CreatedTask = await res.json();
      onCreated(task);
      setTitle("");
      setDescription("");
      setTargetLat("");
      setTargetLng("");
      setRadiusMeters("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold text-slate-900">Create Task</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <Label htmlFor="task-title">Title</Label>
          <Input
            id="task-title"
            type="text"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="task-description">Description</Label>
          <Textarea
            id="task-description"
            required
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="task-lat">Target lat</Label>
            <Input
              id="task-lat"
              type="number"
              step="any"
              required
              value={targetLat}
              onChange={(event) => setTargetLat(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="task-lng">Target lng</Label>
            <Input
              id="task-lng"
              type="number"
              step="any"
              required
              value={targetLng}
              onChange={(event) => setTargetLng(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="task-radius">Radius (m)</Label>
            <Input
              id="task-radius"
              type="number"
              step="1"
              min="1"
              required
              value={radiusMeters}
              onChange={(event) => setRadiusMeters(event.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create Task"}
        </Button>
      </form>
    </Card>
  );
}

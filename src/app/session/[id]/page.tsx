"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  HelpCircleIcon,
  InfoCircleIcon,
  MapPinIcon,
  XCircleIcon,
} from "@/components/icons";
import { Spinner } from "@/components/Spinner";
import { StateBadge } from "@/components/StateBadge";
import { SESSION_STATE_STYLES, type SessionState } from "@/lib/design-tokens";

const RESULT_ICONS: Record<"VERIFIED" | "FLAGGED" | "INCONCLUSIVE", typeof CheckCircleIcon> = {
  VERIFIED: CheckCircleIcon,
  FLAGGED: XCircleIcon,
  INCONCLUSIVE: HelpCircleIcon,
};

interface Task {
  title: string;
  description: string;
}

interface VerificationResult {
  confidenceScore: number;
  reasons: string[];
}

interface SessionData {
  id: string;
  state: SessionState;
  task: Task;
  result: VerificationResult | null;
}

interface Position {
  lat: number;
  lng: number;
  accuracyMeters: number;
}

const PING_INTERVAL_MS = 20_000;
const POOR_ACCURACY_THRESHOLD_METERS = 100;

export default function SessionPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [session, setSession] = useState<SessionData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [position, setPosition] = useState<Position | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const positionRef = useRef<Position | null>(null);

  const [reportText, setReportText] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const refetch = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (!res.ok) {
        setLoadError(res.status === 404 ? "Session not found" : "Failed to load session");
        return;
      }
      const data: SessionData = await res.json();
      setSession(data);
      setLoadError(null);
    } catch {
      setLoadError("Failed to load session");
    }
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Track location while the visit is ACTIVE.
  useEffect(() => {
    if (session?.state !== "ACTIVE") return;

    if (!("geolocation" in navigator)) {
      setGeoError("Geolocation is not supported by this browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next: Position = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
        };
        positionRef.current = next;
        setPosition(next);
        setGeoError(null);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeoError(
            "Location access was denied. Your visit will continue, but location data won't be collected to help verify it."
          );
        } else {
          setGeoError(`Unable to get your location: ${error.message}`);
        }
      },
      { enableHighAccuracy: true }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [session?.state]);

  // Send the latest known position every 20s while ACTIVE.
  useEffect(() => {
    if (session?.state !== "ACTIVE") return;

    const interval = setInterval(() => {
      const pos = positionRef.current;
      if (!pos) return;
      fetch(`/api/sessions/${id}/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pos),
      }).catch(() => {
        // best-effort; the next tick will retry with the latest position
      });
    }, PING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [session?.state, id]);

  async function callAction(path: string, body?: unknown): Promise<void> {
    const res = await fetch(`/api/sessions/${id}${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `Request failed (${res.status})`);
    }
  }

  async function handleStart(): Promise<void> {
    setActionError(null);
    try {
      await callAction("/start");
      await refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  async function handleEnd(): Promise<void> {
    setActionError(null);
    try {
      await callAction("/end");
      await refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  async function handleSubmitReport(): Promise<void> {
    if (submittingReport) return;
    setActionError(null);
    setSubmittingReport(true);
    try {
      await callAction("/report", { text: reportText });
      await refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setSubmittingReport(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-xl px-6 py-8">
          <Card className="p-6 text-red-700">{loadError}</Card>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <main className="mx-auto max-w-xl px-6 py-8">
          <p className="text-sm text-slate-500">Loading…</p>
        </main>
      </div>
    );
  }

  const isFinalState =
    session.state === "VERIFIED" || session.state === "FLAGGED" || session.state === "INCONCLUSIVE";

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{session.task.title}</h1>
          <StateBadge state={session.state} />
        </div>

        {actionError && (
          <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</Card>
        )}

        {session.state === "ASSIGNED" && (
          <Card className="space-y-4 p-6">
            <p className="text-sm leading-relaxed text-slate-600">{session.task.description}</p>
            <Button onClick={handleStart}>Start Visit</Button>
          </Card>
        )}

        {session.state === "ACTIVE" && (
          <div className="space-y-4">
            <Card className="flex gap-3 border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <InfoCircleIcon className="h-5 w-5 flex-shrink-0 text-slate-400" />
              <p>
                Your device location is being collected periodically while this visit is
                active, to help verify you were at the task location.
              </p>
            </Card>

            {geoError && (
              <Card className="flex gap-3 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <AlertTriangleIcon className="h-5 w-5 flex-shrink-0 text-amber-500" />
                <p>{geoError}</p>
              </Card>
            )}

            <Card className="p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <MapPinIcon className="h-5 w-5 text-slate-400" />
                Current location
              </div>

              {position ? (
                <div className="mt-4 space-y-3">
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-slate-500">Latitude</dt>
                      <dd className="tabular-nums text-slate-900">{position.lat.toFixed(6)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Longitude</dt>
                      <dd className="tabular-nums text-slate-900">{position.lng.toFixed(6)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Accuracy</dt>
                      <dd className="tabular-nums text-slate-900">
                        {position.accuracyMeters.toFixed(0)}m
                      </dd>
                    </div>
                  </dl>

                  {position.accuracyMeters > POOR_ACCURACY_THRESHOLD_METERS && (
                    <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                      <AlertTriangleIcon className="h-5 w-5 flex-shrink-0 text-amber-500" />
                      <p>
                        GPS accuracy is poor ({position.accuracyMeters.toFixed(0)}m).
                        Verification may be less reliable.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                !geoError && (
                  <p className="mt-4 text-sm text-slate-400">Waiting for location…</p>
                )
              )}
            </Card>

            <Button variant="secondary" onClick={handleEnd}>
              End Visit
            </Button>
          </div>
        )}

        {session.state === "ENDED" && (
          <Card className="space-y-4 p-6">
            <textarea
              value={reportText}
              onChange={(event) => setReportText(event.target.value)}
              placeholder="Describe your visit..."
              className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
              rows={5}
              disabled={submittingReport}
            />
            <Button onClick={handleSubmitReport} disabled={submittingReport}>
              {submittingReport && <Spinner className="h-4 w-4" />}
              {submittingReport ? "Submitting…" : "Submit Report"}
            </Button>
            {submittingReport && (
              <p className="text-sm text-slate-500">Verifying your visit…</p>
            )}
          </Card>
        )}

        {session.state === "REPORT_SUBMITTED" && (
          <Card className="flex items-center gap-3 p-6 text-sm text-slate-600">
            <Spinner className="h-4 w-4 text-slate-400" />
            Verifying your visit…
          </Card>
        )}

        {isFinalState && (
          <Card className="p-6">
            <div className="flex items-center gap-3">
              {(() => {
                const ResultIcon =
                  RESULT_ICONS[session.state as "VERIFIED" | "FLAGGED" | "INCONCLUSIVE"];
                return (
                  <ResultIcon
                    className={`h-9 w-9 flex-shrink-0 ${SESSION_STATE_STYLES[session.state].textClassName}`}
                  />
                );
              })()}
              <p className={`text-xl font-bold ${SESSION_STATE_STYLES[session.state].textClassName}`}>
                {SESSION_STATE_STYLES[session.state].label}
              </p>
            </div>

            {session.result && (
              <div className="mt-5 space-y-4">
                <ConfidenceBar
                  score={session.result.confidenceScore}
                  colorClassName={SESSION_STATE_STYLES[session.state].accentClassName}
                />
                <ul className="space-y-1.5 text-sm text-slate-600">
                  {session.result.reasons.map((reason) => (
                    <li key={reason} className="flex gap-2">
                      <span className="text-slate-300">•</span>
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}

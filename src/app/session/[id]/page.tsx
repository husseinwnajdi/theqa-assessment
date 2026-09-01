"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { SESSION_STATE_BADGE_CLASSES, type SessionState } from "@/lib/sessionStateStyles";

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
      <main className="p-6">
        <p className="text-red-700">{loadError}</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="p-6">
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{session.task.title}</h1>
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${SESSION_STATE_BADGE_CLASSES[session.state]}`}
        >
          {session.state}
        </span>
      </div>

      {actionError && <p className="text-red-700 text-sm">{actionError}</p>}

      {session.state === "ASSIGNED" && (
        <div className="space-y-3">
          <p className="text-sm">{session.task.description}</p>
          <button onClick={handleStart} className="px-4 py-2 bg-blue-600 text-white rounded">
            Start Visit
          </button>
        </div>
      )}

      {session.state === "ACTIVE" && (
        <div className="space-y-3">
          <p className="text-xs text-gray-600">
            Your device location is being collected periodically while this visit is active,
            to help verify you were at the task location.
          </p>

          {geoError && <p className="text-amber-700 text-sm">{geoError}</p>}

          {position ? (
            <div className="text-sm space-y-1">
              <p>Lat: {position.lat.toFixed(6)}</p>
              <p>Lng: {position.lng.toFixed(6)}</p>
              <p>Accuracy: {position.accuracyMeters.toFixed(0)}m</p>
              {position.accuracyMeters > POOR_ACCURACY_THRESHOLD_METERS && (
                <p className="text-amber-700">
                  GPS accuracy is poor ({position.accuracyMeters.toFixed(0)}m). Verification
                  may be less reliable.
                </p>
              )}
            </div>
          ) : (
            !geoError && <p className="text-sm text-gray-600">Waiting for location…</p>
          )}

          <button onClick={handleEnd} className="px-4 py-2 bg-gray-800 text-white rounded">
            End Visit
          </button>
        </div>
      )}

      {session.state === "ENDED" && (
        <div className="space-y-3">
          <textarea
            value={reportText}
            onChange={(event) => setReportText(event.target.value)}
            placeholder="Describe your visit..."
            className="w-full border rounded p-2 text-sm"
            rows={5}
            disabled={submittingReport}
          />
          <button
            onClick={handleSubmitReport}
            disabled={submittingReport}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {submittingReport ? "Submitting…" : "Submit Report"}
          </button>
          {submittingReport && <p className="text-sm text-gray-600">Verifying your visit…</p>}
        </div>
      )}

      {session.state === "REPORT_SUBMITTED" && <p>Verifying your visit…</p>}

      {(session.state === "VERIFIED" ||
        session.state === "FLAGGED" ||
        session.state === "INCONCLUSIVE") && (
        <div className="space-y-2">
          <p className="font-medium">Result: {session.state}</p>
          {session.result && (
            <>
              <p className="text-sm">Confidence score: {session.result.confidenceScore}/100</p>
              <ul className="list-disc list-inside text-sm">
                {session.result.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </main>
  );
}

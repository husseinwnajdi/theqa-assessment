export interface QueuedPing {
  lat: number;
  lng: number;
  accuracyMeters: number;
  timestamp: string;
}

function storageKey(sessionId: string): string {
  return `pending-pings-${sessionId}`;
}

export function getQueuedPings(sessionId: string): QueuedPing[] {
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedPing[]) : [];
  } catch {
    return [];
  }
}

export function saveQueuedPings(sessionId: string, pings: QueuedPing[]): void {
  try {
    window.localStorage.setItem(storageKey(sessionId), JSON.stringify(pings));
  } catch {
    // localStorage unavailable (private browsing, quota exceeded, etc.) — this
    // resilience layer is best-effort, so degrade silently rather than throw.
  }
}

export function enqueuePing(sessionId: string, ping: QueuedPing): QueuedPing[] {
  const next = [...getQueuedPings(sessionId), ping];
  saveQueuedPings(sessionId, next);
  return next;
}

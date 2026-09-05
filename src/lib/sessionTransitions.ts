import { SessionState } from "@prisma/client";

const HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class InvalidTransitionError extends Error {}

export function assertCanStart(state: SessionState): void {
  if (state !== "ASSIGNED") {
    throw new InvalidTransitionError(`Cannot start session in state ${state}`);
  }
}

export function assertCanPing(state: SessionState): void {
  if (state !== "ACTIVE") {
    throw new InvalidTransitionError(`Cannot record ping in state ${state}`);
  }
}

export function assertCanEnd(state: SessionState): void {
  if (state !== "ACTIVE") {
    throw new InvalidTransitionError(`Cannot end session in state ${state}`);
  }
}

export function assertCanSubmitReport(state: SessionState): void {
  if (state !== "ENDED") {
    throw new InvalidTransitionError(`Cannot submit report in state ${state}`);
  }
}

export function isStale(state: SessionState, lastPingAt: Date | null, now: Date): boolean {
  if (state !== "ACTIVE" || !lastPingAt) return false;
  return now.getTime() - lastPingAt.getTime() > HEARTBEAT_TIMEOUT_MS;
}

// DECISION: 70/40 thresholds leave a wide INCONCLUSIVE band instead of a single pass/fail cutoff, since a confidence score close to the line shouldn't be forced into VERIFIED or FLAGGED.
export function resolveVerificationState(confidenceScore: number): SessionState {
  if (confidenceScore >= 70) return "VERIFIED";
  if (confidenceScore >= 40) return "INCONCLUSIVE";
  return "FLAGGED";
}
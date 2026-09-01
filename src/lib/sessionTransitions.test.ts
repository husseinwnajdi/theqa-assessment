// This is the only module with real logic in the Next.js app (the session
// state machine): every other route/component is thin plumbing already
// verified manually end-to-end, so it's the one place unit tests earn
// their keep here. Coverage: each assertCan* rejects every state except
// its one valid state; resolveVerificationState is checked at its exact
// score boundaries (69/70, 39/40) since off-by-one errors there silently
// misclassify a visit; isStale is checked at exactly the heartbeat
// timeout, just under, just over, and with a null lastPingAt.

import { describe, expect, it } from "vitest";
import type { SessionState } from "@prisma/client";

import {
  assertCanEnd,
  assertCanPing,
  assertCanStart,
  assertCanSubmitReport,
  InvalidTransitionError,
  isStale,
  resolveVerificationState,
} from "./sessionTransitions";

const ALL_STATES: SessionState[] = [
  "ASSIGNED",
  "ACTIVE",
  "ENDED",
  "REPORT_SUBMITTED",
  "VERIFIED",
  "FLAGGED",
  "INCONCLUSIVE",
];

function otherStates(valid: SessionState): SessionState[] {
  return ALL_STATES.filter((state) => state !== valid);
}

describe("assertCanStart", () => {
  it("allows ASSIGNED", () => {
    expect(() => assertCanStart("ASSIGNED")).not.toThrow();
  });

  it.each(otherStates("ASSIGNED"))("rejects %s", (state) => {
    expect(() => assertCanStart(state)).toThrow(InvalidTransitionError);
  });
});

describe("assertCanPing", () => {
  it("allows ACTIVE", () => {
    expect(() => assertCanPing("ACTIVE")).not.toThrow();
  });

  it.each(otherStates("ACTIVE"))("rejects %s", (state) => {
    expect(() => assertCanPing(state)).toThrow(InvalidTransitionError);
  });
});

describe("assertCanEnd", () => {
  it("allows ACTIVE", () => {
    expect(() => assertCanEnd("ACTIVE")).not.toThrow();
  });

  it.each(otherStates("ACTIVE"))("rejects %s", (state) => {
    expect(() => assertCanEnd(state)).toThrow(InvalidTransitionError);
  });
});

describe("assertCanSubmitReport", () => {
  it("allows ENDED", () => {
    expect(() => assertCanSubmitReport("ENDED")).not.toThrow();
  });

  it.each(otherStates("ENDED"))("rejects %s", (state) => {
    expect(() => assertCanSubmitReport(state)).toThrow(InvalidTransitionError);
  });
});

describe("resolveVerificationState", () => {
  it("69 is INCONCLUSIVE (just below VERIFIED threshold)", () => {
    expect(resolveVerificationState(69)).toBe("INCONCLUSIVE");
  });

  it("70 is VERIFIED (exact threshold)", () => {
    expect(resolveVerificationState(70)).toBe("VERIFIED");
  });

  it("39 is FLAGGED (just below INCONCLUSIVE threshold)", () => {
    expect(resolveVerificationState(39)).toBe("FLAGGED");
  });

  it("40 is INCONCLUSIVE (exact threshold)", () => {
    expect(resolveVerificationState(40)).toBe("INCONCLUSIVE");
  });
});

describe("isStale", () => {
  const FIVE_MIN_MS = 5 * 60 * 1000;
  const now = new Date("2026-08-31T12:00:00Z");

  it("is not stale at exactly the timeout", () => {
    const lastPingAt = new Date(now.getTime() - FIVE_MIN_MS);
    expect(isStale("ACTIVE", lastPingAt, now)).toBe(false);
  });

  it("is not stale just under the timeout", () => {
    const lastPingAt = new Date(now.getTime() - (FIVE_MIN_MS - 1));
    expect(isStale("ACTIVE", lastPingAt, now)).toBe(false);
  });

  it("is stale just over the timeout", () => {
    const lastPingAt = new Date(now.getTime() - (FIVE_MIN_MS + 1));
    expect(isStale("ACTIVE", lastPingAt, now)).toBe(true);
  });

  it("is never stale with a null lastPingAt", () => {
    expect(isStale("ACTIVE", null, now)).toBe(false);
  });

  it("is never stale outside ACTIVE, even if overdue", () => {
    const lastPingAt = new Date(now.getTime() - (FIVE_MIN_MS + 1));
    expect(isStale("ENDED", lastPingAt, now)).toBe(false);
  });
});

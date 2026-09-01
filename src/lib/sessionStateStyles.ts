export type SessionState =
  | "ASSIGNED"
  | "ACTIVE"
  | "ENDED"
  | "REPORT_SUBMITTED"
  | "VERIFIED"
  | "FLAGGED"
  | "INCONCLUSIVE";

export const SESSION_STATE_BADGE_CLASSES: Record<SessionState, string> = {
  ASSIGNED: "bg-gray-200 text-gray-800",
  ACTIVE: "bg-blue-200 text-blue-800",
  ENDED: "bg-yellow-200 text-yellow-800",
  REPORT_SUBMITTED: "bg-purple-200 text-purple-800",
  VERIFIED: "bg-green-200 text-green-800",
  FLAGGED: "bg-red-200 text-red-800",
  INCONCLUSIVE: "bg-orange-200 text-orange-800",
};

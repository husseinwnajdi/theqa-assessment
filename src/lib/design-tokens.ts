export type SessionState =
  | "ASSIGNED"
  | "ACTIVE"
  | "ENDED"
  | "REPORT_SUBMITTED"
  | "VERIFIED"
  | "FLAGGED"
  | "INCONCLUSIVE";

interface SessionStateStyle {
  label: string;
  badgeClassName: string;
  dotClassName: string;
  accentClassName: string;
  textClassName: string;
}

const NEUTRAL = {
  badgeClassName: "bg-slate-100 text-slate-700 border border-slate-200",
  dotClassName: "bg-slate-400",
  accentClassName: "bg-slate-400",
  textClassName: "text-slate-700",
};

export const SESSION_STATE_STYLES: Record<SessionState, SessionStateStyle> = {
  ASSIGNED: { label: "Assigned", ...NEUTRAL },
  ACTIVE: { label: "Active", ...NEUTRAL },
  ENDED: { label: "Ended", ...NEUTRAL },
  REPORT_SUBMITTED: { label: "Report submitted", ...NEUTRAL },
  VERIFIED: {
    label: "Verified",
    badgeClassName: "bg-green-50 text-green-700 border border-green-200",
    dotClassName: "bg-green-500",
    accentClassName: "bg-green-500",
    textClassName: "text-green-700",
  },
  FLAGGED: {
    label: "Flagged",
    badgeClassName: "bg-red-50 text-red-700 border border-red-200",
    dotClassName: "bg-red-500",
    accentClassName: "bg-red-500",
    textClassName: "text-red-700",
  },
  INCONCLUSIVE: {
    label: "Inconclusive",
    badgeClassName: "bg-amber-50 text-amber-700 border border-amber-200",
    dotClassName: "bg-amber-500",
    accentClassName: "bg-amber-500",
    textClassName: "text-amber-700",
  },
};

import { SESSION_STATE_STYLES, type SessionState } from "@/lib/design-tokens";

export function StateBadge({ state }: { state: SessionState }) {
  const style = SESSION_STATE_STYLES[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style.badgeClassName}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dotClassName}`} />
      {style.label}
    </span>
  );
}

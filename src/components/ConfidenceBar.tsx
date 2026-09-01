interface ConfidenceBarProps {
  score: number;
  colorClassName: string;
}

export function ConfidenceBar({ score, colorClassName }: ConfidenceBarProps) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${colorClassName}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-sm tabular-nums text-slate-700">{score}/100</span>
    </div>
  );
}

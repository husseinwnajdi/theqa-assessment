interface IconProps {
  className?: string;
}

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  "aria-hidden": true,
} as const;

export function CheckCircleIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function XCircleIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 9.5l5 5m0-5l-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HelpCircleIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M9.5 9.3a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .8-1 1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="16.5" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function AlertTriangleIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9.5v4.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="17" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MapPinIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <path
        d="M12 21s-6.5-6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5-6.5 11-6.5 11Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function InfoCircleIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 11v5.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="8" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/*
 * Handritat garnnystan med stickor — värme i tomma tillstånd.
 * Färgerna följer temat via CSS-variabler.
 */
export default function YarnBall({ size = 84 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
      className="yarn-ball"
    >
      {/* Stickorna */}
      <line x1="22" y1="14" x2="78" y2="70" stroke="var(--text-dim)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="74" y1="14" x2="18" y2="70" stroke="var(--text-dim)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="22" cy="14" r="3.4" fill="var(--text-dim)" />
      <circle cx="74" cy="14" r="3.4" fill="var(--text-dim)" />

      {/* Nystanet */}
      <circle cx="48" cy="56" r="27" fill="var(--accent-soft)" stroke="var(--accent-strong)" strokeWidth="2.5" />
      <path d="M24 48 C 38 38, 60 38, 73 50" stroke="var(--accent-strong)" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 60 C 40 50, 58 52, 74 62" stroke="var(--accent-strong)" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 72 C 42 62, 58 64, 68 74" stroke="var(--accent-strong)" strokeWidth="2" strokeLinecap="round" />
      <path d="M38 30 C 34 44, 36 66, 44 82" stroke="var(--accent-strong)" strokeWidth="2" strokeLinecap="round" />
      <path d="M58 30 C 64 44, 62 68, 54 82" stroke="var(--accent-strong)" strokeWidth="2" strokeLinecap="round" />

      {/* Garntråden som ringlar iväg */}
      <path
        d="M74 66 C 88 70, 90 78, 82 82 C 74 86, 70 90, 78 92"
        stroke="var(--accent-strong)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="none"
      />
    </svg>
  );
}

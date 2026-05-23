export default function HouseFigureIllustration({
  className,
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 360 280"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {/* Faint city skyline */}
      <g opacity="0.45">
        <rect x="10" y="60" width="40" height="120" />
        <rect x="18" y="78" width="6" height="6" />
        <rect x="34" y="78" width="6" height="6" />
        <rect x="18" y="100" width="6" height="6" />
        <rect x="34" y="100" width="6" height="6" />
        <rect x="18" y="122" width="6" height="6" />
        <rect x="34" y="122" width="6" height="6" />
        <rect x="58" y="90" width="30" height="90" />
        <rect x="66" y="106" width="5" height="5" />
        <rect x="78" y="106" width="5" height="5" />
        <rect x="66" y="124" width="5" height="5" />
        <rect x="78" y="124" width="5" height="5" />
      </g>

      {/* House */}
      <path d="M 110 180 L 110 80 L 200 40 L 290 80 L 290 180 Z" />
      <path d="M 110 80 L 200 40 L 290 80" />
      {/* Chimney */}
      <path d="M 250 56 L 250 30 L 268 30 L 268 64" />
      {/* Upper window with cross */}
      <rect x="220" y="92" width="36" height="36" />
      <path d="M 238 92 L 238 128" />
      <path d="M 220 110 L 256 110" />
      {/* Circular window */}
      <circle cx="180" cy="110" r="14" />
      <path d="M 166 110 L 194 110" />
      <path d="M 180 96 L 180 124" />
      {/* Door */}
      <rect x="146" y="140" width="28" height="40" />
      <circle cx="170" cy="160" r="1.6" />
      {/* Lower window */}
      <rect x="216" y="140" width="40" height="40" />
      <path d="M 236 140 L 236 180" />
      <path d="M 216 160 L 256 160" />

      {/* Bench */}
      <path d="M 50 218 L 130 218" />
      <path d="M 50 226 L 130 226" />
      <path d="M 50 234 L 130 234" />
      <path d="M 58 234 L 58 256" />
      <path d="M 122 234 L 122 256" />

      {/* Figure on bench */}
      <circle cx="90" cy="178" r="12" />
      {/* Headphones arc */}
      <path d="M 78 178 a 12 12 0 0 1 24 0" />
      {/* Body */}
      <path d="M 78 218 L 80 196 q 0 -6 10 -6 h 0 q 10 0 10 6 L 102 218" />
      {/* Arm holding phone */}
      <path d="M 80 200 q -10 6 -8 18" />
      <rect x="64" y="216" width="10" height="14" rx="1" />
      {/* Legs */}
      <path d="M 82 218 L 78 246" />
      <path d="M 96 218 L 100 246" />

      {/* Ground */}
      <path d="M 0 256 q 30 -8 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0" opacity="0.5" />
    </svg>
  );
}

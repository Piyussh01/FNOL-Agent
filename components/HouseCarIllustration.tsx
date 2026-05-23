export default function HouseCarIllustration({
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
        <rect x="180" y="60" width="36" height="120" />
        <rect x="186" y="78" width="6" height="6" />
        <rect x="200" y="78" width="6" height="6" />
        <rect x="186" y="100" width="6" height="6" />
        <rect x="200" y="100" width="6" height="6" />
        <rect x="186" y="122" width="6" height="6" />
        <rect x="200" y="122" width="6" height="6" />
        <rect x="222" y="90" width="30" height="90" />
        <rect x="228" y="104" width="5" height="5" />
        <rect x="241" y="104" width="5" height="5" />
        <rect x="228" y="124" width="5" height="5" />
        <rect x="241" y="124" width="5" height="5" />
        <rect x="258" y="40" width="44" height="140" />
        <rect x="266" y="58" width="6" height="6" />
        <rect x="282" y="58" width="6" height="6" />
        <rect x="266" y="80" width="6" height="6" />
        <rect x="282" y="80" width="6" height="6" />
        <rect x="266" y="102" width="6" height="6" />
        <rect x="282" y="102" width="6" height="6" />
        <rect x="266" y="124" width="6" height="6" />
        <rect x="282" y="124" width="6" height="6" />
        <rect x="310" y="76" width="34" height="104" />
        <rect x="318" y="90" width="6" height="6" />
        <rect x="332" y="90" width="6" height="6" />
        <rect x="318" y="112" width="6" height="6" />
        <rect x="332" y="112" width="6" height="6" />
      </g>

      {/* House */}
      <path d="M 30 180 L 30 90 L 110 40 L 190 90 L 190 180 Z" />
      {/* Roof line */}
      <path d="M 30 90 L 110 40 L 190 90" />
      {/* Arched upper window */}
      <path d="M 80 80 a 18 18 0 0 1 36 0 L 116 110 L 80 110 Z" />
      <path d="M 98 80 L 98 110" />
      <path d="M 80 95 L 116 95" />
      {/* Door */}
      <rect x="56" y="124" width="28" height="56" />
      <circle cx="78" cy="154" r="1.6" />
      {/* Window */}
      <rect x="120" y="124" width="46" height="40" />
      <path d="M 143 124 L 143 164" />
      <path d="M 120 144 L 166 144" />
      {/* Stoop */}
      <path d="M 48 180 L 48 192 L 92 192 L 92 180" />

      {/* Car */}
      <path d="M 218 178 q 6 -28 36 -28 h 36 q 28 0 36 28" />
      <path d="M 212 180 h 132" />
      <path d="M 212 196 q 0 12 14 12 h 104 q 14 0 14 -12" />
      <path d="M 232 180 v -22 q 0 -6 6 -6 h 50 q 4 0 6 4 l 14 24" />
      <path d="M 268 154 v 26" />
      <circle cx="238" cy="208" r="9" />
      <circle cx="320" cy="208" r="9" />
      {/* Headlight + grille */}
      <path d="M 218 188 h 6" />
      <circle cx="338" cy="188" r="2" />

      {/* Ground */}
      <path d="M 0 240 q 30 -10 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0" opacity="0.5" />
    </svg>
  );
}

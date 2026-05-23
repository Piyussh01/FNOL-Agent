export default function AlchemyLogo({
  className,
  width = 220,
  height = 44,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <svg
      role="img"
      aria-label="Alchemy Insurance"
      viewBox="0 0 340 56"
      width={width}
      height={height}
      className={className}
    >
      <text
        x="0"
        y="40"
        fontFamily="var(--font-fraunces), ui-serif, Georgia, serif"
        fontStyle="italic"
        fontWeight={900}
        fontSize="44"
        letterSpacing="-1.5"
        fill="currentColor"
      >
        Alchemy
      </text>
      <text
        x="190"
        y="40"
        fontFamily="var(--font-fraunces), ui-serif, Georgia, serif"
        fontWeight={400}
        fontSize="20"
        letterSpacing="0.5"
        fill="currentColor"
        opacity="0.7"
      >
        Insurance
      </text>
    </svg>
  );
}

/**
 * BRUE wordmark — rendered as text, not image.
 *
 * Why text? The old /public/Brue*.png files are JPEGs (no alpha channel),
 * which is why the nav logo shipped with a black box behind it. Text in
 * the Instrument Serif display font renders crisp at any DPR, scales
 * without artifacts, and is always transparent.
 *
 * When a proper transparent PNG/SVG is available, swap the guts of this
 * component for an <Image> or <img> without touching the call-sites.
 */

type WordmarkProps = {
  tone?: 'terra' | 'bone' | 'ink';
  size?: number;                // css pixel height of the mark
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
};

const COLOR: Record<NonNullable<WordmarkProps['tone']>, string> = {
  terra: 'var(--terra)',
  bone:  'var(--bone)',
  ink:   'var(--ink)',
};

export default function Wordmark({
  tone = 'terra',
  size = 28,
  className,
  style,
  ariaLabel = 'BRUE',
}: WordmarkProps) {
  return (
    <span
      aria-label={ariaLabel}
      className={className}
      style={{
        fontFamily: 'var(--font-serif), "Instrument Serif", Georgia, serif',
        fontSize: size,
        lineHeight: 1,
        letterSpacing: '-0.02em',
        fontWeight: 400,
        color: COLOR[tone],
        display: 'inline-flex',
        alignItems: 'baseline',
        ...style,
      }}
    >
      BRUE
      <span
        style={{
          marginLeft: 2,
          fontStyle: 'italic',
          fontSize: '0.65em',
          transform: 'translateY(-0.15em)',
          color: COLOR[tone],
          opacity: 0.65,
        }}
      >
        .
      </span>
    </span>
  );
}

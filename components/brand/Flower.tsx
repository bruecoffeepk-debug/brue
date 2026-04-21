/**
 * Brand flower mark — reusable SVG with theme-able color + size.
 *
 *   <Flower size={24} />                    // default terra color via currentColor
 *   <Flower size={48} color="var(--sage)" />
 *   <Flower spin />                         // slow idle rotation
 *
 * Based on the ✿ glyph that runs through BRUE's voice — six teardrop petals,
 * mustard center, organic and hand-drawn feel.
 */

type FlowerProps = {
  size?: number | string;
  color?: string;
  centerColor?: string;
  spin?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
};

export default function Flower({
  size = 24,
  color = 'currentColor',
  centerColor = 'var(--mustard, #d4972e)',
  spin = false,
  className,
  style,
  title,
}: FlowerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        display: 'inline-block',
        color,
        animation: spin ? 'brue-flower-spin 14s linear infinite' : undefined,
        ...style,
      }}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
    >
      <g transform="translate(50 50)">
        {/* six teardrop petals rotated 60° apart */}
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <path
            key={angle}
            d="M0 -42 C8 -28 10 -14 0 0 C-10 -14 -8 -28 0 -42 Z"
            fill={color}
            transform={`rotate(${angle})`}
          />
        ))}
        <circle r="7" fill={centerColor} />
      </g>

      {/* keyframes live on the svg so they travel with the component */}
      <style>{`
        @keyframes brue-flower-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  );
}

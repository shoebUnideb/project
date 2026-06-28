export function MultiSegmentDonut({
  segments, centerLabel, size = 120, stroke = 16,
}: {
  segments: { value: number; color: string }[];
  centerLabel?: string;
  size?: number;
  stroke?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r     = (size - stroke) / 2;
  const cx    = size / 2;
  const cy    = size / 2;
  const circ  = 2 * Math.PI * r;
  let rotation = -90;
  const arcs = segments.map(seg => {
    const dash = total > 0 ? (seg.value / total) * circ : 0;
    const gap  = circ - dash;
    const rot  = rotation;
    rotation  += total > 0 ? (seg.value / total) * 360 : 0;
    return { ...seg, dash, gap, rot };
  });
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={stroke} />
      {total > 0 && arcs.filter(a => a.value > 0).map((a, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={a.color} strokeWidth={stroke}
          strokeDasharray={`${a.dash} ${a.gap}`}
          transform={`rotate(${a.rot} ${cx} ${cy})`}
        />
      ))}
      {centerLabel && (
        <text x={cx} y={cy + 5} textAnchor="middle"
          style={{ fontSize: size > 100 ? 15 : 12, fontWeight: 800 }} fill="#111827">
          {centerLabel}
        </text>
      )}
    </svg>
  );
}

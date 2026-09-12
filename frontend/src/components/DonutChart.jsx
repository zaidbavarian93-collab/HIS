const PALETTE = ['#6366f1', '#22d3ee', '#a855f7', '#f59e0b', '#f43f5e', '#10b981', '#3b82f6', '#eab308'];

// مخطط دائري (Donut) مبني بـ SVG بدون أي مكتبة خارجية، مع مفتاح ألوان (Legend) وقيمة إجمالية في المركز
export default function DonutChart({ data, labels = {}, size = 160, thickness = 22 }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v > 0);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  if (entries.length === 0 || total === 0) {
    return <div className="muted" style={{ fontSize: 13 }}>—</div>;
  }

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offsetAccum = 0;

  const segments = entries.map(([key, value], idx) => {
    const fraction = value / total;
    const dash = fraction * circumference;
    const seg = {
      key,
      value,
      color: PALETTE[idx % PALETTE.length],
      dashArray: `${dash} ${circumference - dash}`,
      dashOffset: -offsetAccum,
      pct: Math.round(fraction * 100),
    };
    offsetAccum += dash;
    return seg;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={thickness} />
          {segments.map((seg) => (
            <circle
              key={seg.key}
              className="donut-segment"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              strokeLinecap="butt"
              style={{ transition: 'stroke-dasharray 0.4s ease, stroke-width 0.15s ease, opacity 0.15s ease' }}
            >
              <title>{`${labels[seg.key] || seg.key}: ${seg.value} (${seg.pct}%)`}</title>
            </circle>
          ))}
        </g>
        <text x="50%" y="48%" textAnchor="middle" fontSize={size * 0.16} fontWeight="700" fill="var(--text)">
          {total}
        </text>
        <text x="50%" y="64%" textAnchor="middle" fontSize={size * 0.08} fill="var(--muted)">
          الإجمالي
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 120 }}>
        {segments.map((seg) => (
          <div
            key={seg.key}
            className="donut-legend-row"
            title={`${labels[seg.key] || seg.key}: ${seg.value} (${seg.pct}%)`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{labels[seg.key] || seg.key}</span>
            <span className="muted">{seg.value} ({seg.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

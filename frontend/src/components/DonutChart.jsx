import { useRef, useState } from 'react';

const PALETTE = ['#6366f1', '#22d3ee', '#a855f7', '#f59e0b', '#f43f5e', '#10b981', '#3b82f6', '#eab308'];

// مخطط دائري (Donut) مبني بـ SVG بدون أي مكتبة خارجية، مع مفتاح ألوان (Legend) وقيمة إجمالية في المركز
// عند تمرير الفأرة فوق أي قطعة أو صف بالمفتاح: توهج للقطعة + نافذة معلومات صغيرة تتبع الفأرة
export default function DonutChart({ data, labels = {}, size = 160, thickness = 22 }) {
  const wrapRef = useRef(null);
  const [tooltip, setTooltip] = useState(null); // { x, y, text }

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

  function showTooltip(e, seg) {
    const wrapRect = wrapRef.current.getBoundingClientRect();
    setTooltip({
      x: e.clientX - wrapRect.left,
      y: e.clientY - wrapRect.top,
      text: `${labels[seg.key] || seg.key}`,
      value: `${seg.value} (${seg.pct}%)`,
      color: seg.color,
    });
  }

  function moveTooltip(e) {
    const wrapRect = wrapRef.current.getBoundingClientRect();
    setTooltip((prev) => (prev ? { ...prev, x: e.clientX - wrapRect.left, y: e.clientY - wrapRect.top } : prev));
  }

  function hideTooltip() {
    setTooltip(null);
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
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
              onMouseEnter={(e) => showTooltip(e, seg)}
              onMouseMove={moveTooltip}
              onMouseLeave={hideTooltip}
            />
          ))}
        </g>
        <text x="50%" y="48%" textAnchor="middle" fontSize={size * 0.16} fontWeight="700" fill="var(--text)">
          {total}
        </text>
        <text x="50%" y="64%" textAnchor="middle" fontSize={size * 0.08} fill="var(--text-muted)">
          الإجمالي
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 120 }}>
        {segments.map((seg) => (
          <div
            key={seg.key}
            className="donut-legend-row"
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}
            onMouseEnter={(e) => showTooltip(e, seg)}
            onMouseMove={moveTooltip}
            onMouseLeave={hideTooltip}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{labels[seg.key] || seg.key}</span>
            <span className="muted">{seg.value} ({seg.pct}%)</span>
          </div>
        ))}
      </div>

      {tooltip && (
        <div
          className="donut-tooltip"
          style={{ left: tooltip.x, top: tooltip.y, borderInlineStartColor: tooltip.color }}
        >
          <span className="donut-tooltip-dot" style={{ background: tooltip.color }} />
          <span className="donut-tooltip-label">{tooltip.text}</span>
          <span className="donut-tooltip-value">{tooltip.value}</span>
        </div>
      )}
    </div>
  );
}

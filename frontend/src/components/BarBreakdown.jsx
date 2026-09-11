// عرض تفصيلي بسيط على شكل أشرطة أفقية بالنسبة المئوية - بدون مكتبة رسوم بيانية خارجية
export default function BarBreakdown({ data, labels = {} }) {
  const entries = Object.entries(data || {}).filter(([, v]) => v > 0);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  if (entries.length === 0) {
    return <div className="muted" style={{ fontSize: 13 }}>—</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {entries.map(([key, value]) => {
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
          <div key={key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
              <span>{labels[key] || key}</span>
              <span className="muted">{value} ({pct}%)</span>
            </div>
            <div style={{ background: 'var(--border)', borderRadius: 8, height: 8, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: 'var(--primary-gradient)',
                  borderRadius: 8,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

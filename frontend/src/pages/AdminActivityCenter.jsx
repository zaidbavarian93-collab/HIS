import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { exportStyledExcel } from '../utils/exportUtils';
import { formatNumber, formatMoney } from '../utils/format';
import DonutChart from '../components/DonutChart';

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset) {
  const now = new Date();
  const end = toISODate(now);
  if (preset === 'day') return { from: end, to: end };
  if (preset === 'week') {
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    return { from: toISODate(start), to: end };
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toISODate(start), to: end };
  }
  return { from: end, to: end };
}

const WAGE_BADGE = { full: 'active', half: 'inactive', none: 'inactive' };

export default function AdminActivityCenter() {
  const { t } = useTranslation();
  const [preset, setPreset] = useState('day');
  const [range, setRange] = useState(presetRange('day'));
  const [summary, setSummary] = useState(null);
  const [detail, setDetail] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [excusingId, setExcusingId] = useState(null);
  const [excuseReason, setExcuseReason] = useState('');

  function applyPreset(p) {
    setPreset(p);
    setRange(presetRange(p));
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [summaryRes, detailRes, visitsRes] = await Promise.all([
        api.get('/admin-activity/summary', { params: { from: range.from, to: range.to } }),
        api.get('/admin-activity/attendance-detail', { params: { from: range.from, to: range.to } }),
        api.get('/admin-activity/visits', { params: { from: range.from, to: range.to } }),
      ]);
      setSummary(summaryRes.data);
      setDetail(detailRes.data);
      setVisits(visitsRes.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [range.from, range.to]);

  async function submitExcuse(recordId) {
    await api.put(`/admin-activity/attendance/${recordId}/excuse`, { is_excused: true, excuse_reason: excuseReason });
    setExcusingId(null);
    setExcuseReason('');
    loadAll();
  }

  async function revokeExcuse(recordId) {
    await api.put(`/admin-activity/attendance/${recordId}/excuse`, { is_excused: false, excuse_reason: null });
    loadAll();
  }

  function wageLabel(w) {
    if (!w) return '-';
    if (w.impact === 'full') return t('wage_full');
    if (w.impact === 'half') return t('wage_half');
    return t('wage_none');
  }

  function exportAttendanceExcel() {
    const rows = detail.map((r) => ({
      [t('date')]: r.date,
      [t('full_name')]: r.User?.full_name || '',
      [t('role_label')]: r.User?.role ? t(`role_${r.User.role}`) : '',
      [t('check_in')]: r.check_in ? new Date(r.check_in).toLocaleTimeString('en-GB') : '-',
      [t('check_out')]: r.check_out ? new Date(r.check_out).toLocaleTimeString('en-GB') : '-',
      [t('attendance_status')]: t(`attendance_status_${r.status}`),
      [t('late_minutes')]: r.wage_impact?.lateMinutes ?? '-',
      [t('wage_impact')]: wageLabel(r.wage_impact),
      [t('excused')]: r.is_excused ? t('yes') : '-',
      [t('excuse_reason')]: r.excuse_reason || '-',
    }));
    exportStyledExcel({
      filename: `تقرير_الحضور_${range.from}_${range.to}`,
      sheetName: t('attendance_report'),
      reportTitle: `${t('attendance_report')} — ${range.from} إلى ${range.to}`,
      reportSubtitle: `${t('official_start_time')}: 8:30`,
      columns: Object.keys(rows[0] || {}).map((k) => ({ key: k, header: k })),
      rows,
    });
  }

  function exportVisitsExcel() {
    const rows = visits.map((v) => ({
      [t('date')]: new Date(v.scheduled_at).toLocaleString('en-GB'),
      [t('visitor_name')]: v.patient_name || '-',
      [t('file_number')]: v.file_number || '-',
      [t('department')]: v.department_name || '-',
      [t('consultation_type')]: v.consultation_type ? t(v.consultation_type) : '-',
      [t('attending_doctor')]: v.doctor_name || '-',
      [t('attendance_status')]: t(v.status),
    }));
    exportStyledExcel({
      filename: `تقرير_المراجعين_${range.from}_${range.to}`,
      sheetName: t('visitors_list'),
      reportTitle: `${t('visitors_list')} — ${range.from} إلى ${range.to}`,
      columns: Object.keys(rows[0] || {}).map((k) => ({ key: k, header: k })),
      rows,
    });
  }

  return (
    <div>
      <div className="topbar">
        <h2>{t('admin_activity_center')}</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="secondary" onClick={exportVisitsExcel} disabled={visits.length === 0}>📊 {t('export_visitors_excel')}</button>
          <button onClick={exportAttendanceExcel} disabled={detail.length === 0}>📊 {t('export_daily_attendance_excel')}</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="tag-list" style={{ marginBottom: 0 }}>
            <button type="button" className={preset === 'day' ? '' : 'secondary'} onClick={() => applyPreset('day')}>{t('period_day')}</button>
            <button type="button" className={preset === 'week' ? '' : 'secondary'} onClick={() => applyPreset('week')}>{t('period_week')}</button>
            <button type="button" className={preset === 'month' ? '' : 'secondary'} onClick={() => applyPreset('month')}>{t('period_month')}</button>
            <button type="button" className={preset === 'custom' ? '' : 'secondary'} onClick={() => setPreset('custom')}>{t('period_custom')}</button>
          </div>
          {preset === 'custom' && (
            <>
              <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} style={{ width: 150, marginBottom: 0 }} />
              <span>→</span>
              <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} style={{ width: 150, marginBottom: 0 }} />
            </>
          )}
          <span className="muted" style={{ fontSize: 12.5 }}>{range.from} → {range.to}</span>
        </div>
      </div>

      {loading && <div className="muted">{t('loading')}</div>}

      {!loading && summary && (
        <>
          <div className="section-title">{t('attendance_summary')}</div>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{t('attendance_rule_hint')}</div>
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <div className="stat-card">
              <div className="stat-label">{t('active_staff_count')}</div>
              <div className="stat-value">{formatNumber(summary.attendance.active_staff_count)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t('wage_full')}</div>
              <div className="stat-value">{formatNumber(summary.attendance.on_time_or_full_wage)}</div>
            </div>
            <div className="stat-card warn">
              <div className="stat-label">{t('wage_half')}</div>
              <div className="stat-value">{formatNumber(summary.attendance.half_wage_deduction)}</div>
            </div>
            <div className="stat-card warn">
              <div className="stat-label">{t('wage_none')}</div>
              <div className="stat-value">{formatNumber(summary.attendance.zero_wage)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t('excused')}</div>
              <div className="stat-value">{formatNumber(summary.attendance.excused)}</div>
            </div>
          </div>

          <div className="section-title">{t('general_activity')}</div>
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <div className="stat-card">
              <div className="stat-label">{t('patient_visits')}</div>
              <div className="stat-value">{formatNumber(summary.visits)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t('total_revenue')}</div>
              <div className="stat-value">{formatMoney(summary.finance.total_revenue)}</div>
            </div>
            <div className="stat-card warn">
              <div className="stat-label">{t('total_expense')}</div>
              <div className="stat-value">{formatMoney(summary.finance.total_expense)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t('net_result')}</div>
              <div className="stat-value">{formatMoney(summary.finance.net)}</div>
            </div>
          </div>

          <div className="section-title">{t('charts_overview')}</div>
          <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div className="section-title">{t('attendance_summary')}</div>
              <DonutChart
                data={{
                  full: summary.attendance.on_time_or_full_wage,
                  half: summary.attendance.half_wage_deduction,
                  none: summary.attendance.zero_wage,
                  excused: summary.attendance.excused,
                }}
                labels={{ full: t('wage_full'), half: t('wage_half'), none: t('wage_none'), excused: t('excused') }}
              />
            </div>
            <div className="card">
              <div className="section-title">{t('visitors_list')}</div>
              <DonutChart
                data={visits.reduce((acc, v) => {
                  acc[v.status] = (acc[v.status] || 0) + 1;
                  return acc;
                }, {})}
                labels={visits.reduce((acc, v) => {
                  acc[v.status] = t(v.status);
                  return acc;
                }, {})}
              />
            </div>
            <div className="card">
              <div className="section-title">{t('total_revenue')} / {t('total_expense')}</div>
              <DonutChart
                data={{ revenue: summary.finance.total_revenue, expense: summary.finance.total_expense }}
                labels={{ revenue: t('total_revenue'), expense: t('total_expense') }}
              />
            </div>
          </div>
        </>
      )}

      {!loading && (
        <div className="card" style={{ overflowX: 'auto', marginBottom: 16 }}>
          <div className="section-title">{t('visitors_list')}</div>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{t('visitors_list_hint')}</div>
          <table>
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('visitor_name')}</th>
                <th>{t('file_number')}</th>
                <th>{t('department')}</th>
                <th>{t('consultation_type')}</th>
                <th>{t('attending_doctor')}</th>
                <th>{t('attendance_status')}</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id}>
                  <td>{new Date(v.scheduled_at).toLocaleString('en-GB')}</td>
                  <td>{v.patient_name || '-'}</td>
                  <td>{v.file_number || '-'}</td>
                  <td>{v.department_name || '-'}</td>
                  <td>{v.consultation_type ? t(v.consultation_type) : '-'}</td>
                  <td>{v.doctor_name || '-'}</td>
                  <td><span className="badge active">{t(v.status)}</span></td>
                </tr>
              ))}
              {visits.length === 0 && <tr><td colSpan={7} className="muted">{t('no_data')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <div className="section-title">{t('attendance_detail')}</div>
          <table>
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('full_name')}</th>
                <th>{t('role_label')}</th>
                <th>{t('check_in')}</th>
                <th>{t('check_out')}</th>
                <th>{t('late_minutes')}</th>
                <th>{t('wage_impact')}</th>
                <th>{t('excused')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {detail.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.User?.full_name}</td>
                  <td>{r.User?.role ? t(`role_${r.User.role}`) : '-'}</td>
                  <td>{r.check_in ? new Date(r.check_in).toLocaleTimeString('en-GB') : '-'}</td>
                  <td>{r.check_out ? new Date(r.check_out).toLocaleTimeString('en-GB') : '-'}</td>
                  <td>{r.wage_impact?.lateMinutes ?? '-'}</td>
                  <td><span className={`badge ${WAGE_BADGE[r.wage_impact?.impact] || 'inactive'}`}>{wageLabel(r.wage_impact)}</span></td>
                  <td>
                    {r.is_excused ? (
                      <span title={r.excuse_reason || ''}>
                        ✓ {t('yes')}{' '}
                        <button type="button" className="secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => revokeExcuse(r.id)}>{t('cancel')}</button>
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    {!r.is_excused && (
                      excusingId === r.id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input placeholder={t('excuse_reason')} value={excuseReason} onChange={(e) => setExcuseReason(e.target.value)} style={{ marginBottom: 0, width: 140 }} />
                          <button type="button" onClick={() => submitExcuse(r.id)}>{t('confirm')}</button>
                          <button type="button" className="secondary" onClick={() => setExcusingId(null)}>{t('cancel')}</button>
                        </div>
                      ) : (
                        <button type="button" className="secondary" onClick={() => setExcusingId(r.id)}>{t('grant_excuse')}</button>
                      )
                    )}
                  </td>
                </tr>
              ))}
              {detail.length === 0 && <tr><td colSpan={9} className="muted">{t('no_data')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

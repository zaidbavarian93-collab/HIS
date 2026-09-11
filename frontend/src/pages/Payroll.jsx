import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatMoney as fmt } from '../utils/format';
import { exportStyledExcel } from '../utils/exportUtils';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// يطبع محتوى HTML عبر إطار مخفي داخل الصفحة نفسها - لا يعتمد على صلاحية فتح نوافذ منبثقة
function printHtml(title, bodyHtml) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <html dir="rtl" lang="ar">
      <head>
        <title>${title}</title>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body { font-family: Tahoma, Arial, sans-serif; padding: 32px; color: #1e2530; }
          h1 { font-size: 20px; margin: 0 0 4px; }
          .meta { color: #5a6474; font-size: 13px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #d3dae3; padding: 8px 10px; text-align: right; font-size: 13px; }
          th { background: #f4f6f8; font-weight: 700; }
          tfoot td { font-weight: 700; background: #f4f6f8; }
          .badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
          .badge.paid { background: #d7f5df; color: #1a7d3a; }
          .badge.pending { background: #fdecc8; color: #92650a; }
          .row-2 { display: flex; justify-content: space-between; margin: 24px 0 8px; font-size: 13px; }
          .signature { margin-top: 60px; display: flex; justify-content: space-between; font-size: 13px; }
          .signature div { width: 200px; border-top: 1px solid #333; padding-top: 6px; text-align: center; }
        </style>
      </head>
      <body>${bodyHtml}</body>
    </html>
  `);
  doc.close();

  iframe.onload = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
}

export default function Payroll() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [month, setMonth] = useState(currentMonth());
  const [payrolls, setPayrolls] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ allowances: 0, deductions: 0, social_security_deduction: 0, income_tax_deduction: 0, notes: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(null);

  async function loadPayrolls() {
    const { data } = await api.get('/payroll', { params: { month } });
    setPayrolls(data);
  }

  async function loadSettings() {
    const { data } = await api.get('/settings/payroll-deductions');
    setSettings(data);
  }

  useEffect(() => { loadPayrolls(); }, [month]);
  useEffect(() => { loadSettings(); }, []);

  async function generatePayroll() {
    const { data } = await api.post('/payroll/generate', { month });
    setPayrolls(data.payrolls);
  }

  async function saveSettings() {
    await api.put('/settings/payroll-deductions', settings);
    setShowSettings(false);
  }

  function updateBracketRate(index, rate) {
    const brackets = [...settings.tax_brackets];
    brackets[index] = { ...brackets[index], rate: Number(rate) };
    setSettings({ ...settings, tax_brackets: brackets });
  }

  function updateBracketUpTo(index, upTo) {
    const brackets = [...settings.tax_brackets];
    brackets[index] = { ...brackets[index], upTo: upTo === '' ? null : Number(upTo) };
    setSettings({ ...settings, tax_brackets: brackets });
  }

  function startEdit(p) {
    setEditingId(p.id);
    setDraft({
      allowances: p.allowances, deductions: p.deductions,
      social_security_deduction: p.social_security_deduction, income_tax_deduction: p.income_tax_deduction,
      notes: p.notes || '',
    });
  }

  async function saveEdit(id) {
    await api.put(`/payroll/${id}`, draft);
    setEditingId(null);
    loadPayrolls();
  }

  async function payNow(id) {
    await api.put(`/payroll/${id}/pay`);
    loadPayrolls();
  }

  async function removePayroll(id) {
    await api.delete(`/payroll/${id}`);
    loadPayrolls();
  }

  function netPreview(p) {
    return fmt(
      Number(p.base_salary) + Number(draft.allowances) - Number(draft.deductions)
      - Number(draft.social_security_deduction) - Number(draft.income_tax_deduction)
    );
  }

  const totalNet = payrolls.reduce((sum, p) => sum + Number(p.net_salary), 0);
  const totalBase = payrolls.reduce((sum, p) => sum + Number(p.base_salary), 0);
  const totalAllowances = payrolls.reduce((sum, p) => sum + Number(p.allowances), 0);
  const totalDeductions = payrolls.reduce((sum, p) => sum + Number(p.deductions), 0);
  const totalSocialSecurity = payrolls.reduce((sum, p) => sum + Number(p.social_security_deduction), 0);
  const totalIncomeTax = payrolls.reduce((sum, p) => sum + Number(p.income_tax_deduction), 0);
  const paidCount = payrolls.filter((p) => p.status === 'paid').length;
  const pendingCount = payrolls.length - paidCount;

  function printFullReport() {
    const rows = payrolls
      .map(
        (p) => `
        <tr>
          <td>${p.User?.full_name || ''}</td>
          <td>${p.present_days} / ${p.absent_days} / ${p.late_days}</td>
          <td>${fmt(p.base_salary)}</td>
          <td>${fmt(p.allowances)}</td>
          <td>${fmt(p.deductions)}</td>
          <td>${fmt(p.social_security_deduction)}</td>
          <td>${fmt(p.income_tax_deduction)}</td>
          <td><strong>${fmt(p.net_salary)}</strong></td>
          <td><span class="badge ${p.status === 'paid' ? 'paid' : 'pending'}">${p.status === 'paid' ? t('paid') : t('pending')}</span></td>
        </tr>`
      )
      .join('');

    const body = `
      <h1>${t('payroll_report_title')}</h1>
      <div class="meta">${t('month')}: ${month} &nbsp;|&nbsp; ${t('printed_on')}: ${new Date().toLocaleString('en-GB')}</div>
      <table>
        <thead>
          <tr>
            <th>${t('full_name')}</th>
            <th>${t('attendance_short')}</th>
            <th>${t('base_salary')}</th>
            <th>${t('allowances')}</th>
            <th>${t('deductions')}</th>
            <th>${t('social_security')}</th>
            <th>${t('income_tax')}</th>
            <th>${t('net_salary')}</th>
            <th>${t('status')}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="2">${t('totals')}</td>
            <td>${fmt(totalBase)}</td>
            <td>${fmt(totalAllowances)}</td>
            <td>${fmt(totalDeductions)}</td>
            <td>${fmt(totalSocialSecurity)}</td>
            <td>${fmt(totalIncomeTax)}</td>
            <td>${fmt(totalNet)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <div class="row-2">
        <div>${t('paid_count')}: ${paidCount} &nbsp;|&nbsp; ${t('pending_count')}: ${pendingCount} &nbsp;|&nbsp; ${t('total_employees')}: ${payrolls.length}</div>
      </div>
    `;
    printHtml(`${t('payroll_report_title')} - ${month}`, body);
  }

  function exportPayrollExcel() {
    const rows = payrolls.map((p) => ({
      [t('full_name')]: p.User?.full_name || '',
      [t('base_salary')]: Number(p.base_salary),
      [t('allowances')]: Number(p.allowances),
      [t('deductions')]: Number(p.deductions),
      [t('social_security')]: Number(p.social_security_deduction),
      [t('income_tax')]: Number(p.income_tax_deduction),
      [t('net_salary')]: Number(p.net_salary),
      [t('status')]: p.status === 'paid' ? t('paid') : t('pending'),
    }));
    exportStyledExcel({
      filename: `الرواتب_${month}`,
      sheetName: t('payroll'),
      reportTitle: `${t('payroll_report_title')} — ${month}`,
      reportSubtitle: `${t('paid_count')}: ${paidCount} | ${t('pending_count')}: ${pendingCount} | ${t('total_employees')}: ${payrolls.length}`,
      columns: [
        { key: t('full_name'), header: t('full_name') },
        { key: t('base_salary'), header: t('base_salary'), numFmt: '#,##0.00' },
        { key: t('allowances'), header: t('allowances'), numFmt: '#,##0.00' },
        { key: t('deductions'), header: t('deductions'), numFmt: '#,##0.00' },
        { key: t('social_security'), header: t('social_security'), numFmt: '#,##0.00' },
        { key: t('income_tax'), header: t('income_tax'), numFmt: '#,##0.00' },
        { key: t('net_salary'), header: t('net_salary'), numFmt: '#,##0.00' },
        { key: t('status'), header: t('status') },
      ],
      rows,
      totalsRow: {
        [t('full_name')]: t('totals'),
        [t('base_salary')]: totalBase,
        [t('allowances')]: totalAllowances,
        [t('deductions')]: totalDeductions,
        [t('social_security')]: totalSocialSecurity,
        [t('income_tax')]: totalIncomeTax,
        [t('net_salary')]: totalNet,
        [t('status')]: '',
      },
    });
  }

  function printPayslip(p) {
    const body = `
      <h1>${t('payslip_title')}</h1>
      <div class="meta">${t('month')}: ${p.month} &nbsp;|&nbsp; ${t('printed_on')}: ${new Date().toLocaleString('en-GB')}</div>
      <table>
        <tbody>
          <tr><th>${t('full_name')}</th><td>${p.User?.full_name || ''}</td></tr>
          <tr><th>${t('attendance')}</th><td>${t('present')}: ${p.present_days} — ${t('absent')}: ${p.absent_days} — ${t('late')}: ${p.late_days} — ${t('leave')}: ${p.leave_days}</td></tr>
          <tr><th>${t('base_salary')}</th><td>${fmt(p.base_salary)}</td></tr>
          <tr><th>${t('allowances')}</th><td>${fmt(p.allowances)}</td></tr>
          <tr><th>${t('deductions')}</th><td>${fmt(p.deductions)}</td></tr>
          <tr><th>${t('social_security')}</th><td>${fmt(p.social_security_deduction)}</td></tr>
          <tr><th>${t('income_tax')}</th><td>${fmt(p.income_tax_deduction)}</td></tr>
          <tr><th>${t('net_salary')}</th><td><strong>${fmt(p.net_salary)}</strong></td></tr>
          <tr><th>${t('status')}</th><td><span class="badge ${p.status === 'paid' ? 'paid' : 'pending'}">${p.status === 'paid' ? t('paid') : t('pending')}</span></td></tr>
          ${p.notes ? `<tr><th>${t('notes')}</th><td>${p.notes}</td></tr>` : ''}
        </tbody>
      </table>
      <div class="signature">
        <div>${t('employee_signature')}</div>
        <div>${t('hr_signature')}</div>
      </div>
    `;
    printHtml(`${t('payslip_title')} - ${p.User?.full_name || ''}`, body);
  }

  return (
    <div>
      <div className="topbar">
        <h2>{t('payroll')}</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 160, marginBottom: 0 }} />
          <button onClick={generatePayroll}>{t('generate_payroll')}</button>
          <button className="secondary" onClick={printFullReport} disabled={payrolls.length === 0}>🖨️ {t('print_report')}</button>
          <button className="secondary" onClick={exportPayrollExcel} disabled={payrolls.length === 0}>📊 {t('export_excel')}</button>
          {isAdmin && <button className="secondary" onClick={() => setShowSettings(!showSettings)}>⚙️ {t('deduction_settings')}</button>}
        </div>
      </div>

      {showSettings && settings && (
        <form className="card" onSubmit={(e) => { e.preventDefault(); saveSettings(); }}>
          <div className="section-title">{t('deduction_settings')}</div>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{t('deduction_settings_hint')}</div>
          <div className="grid-2">
            <div>
              <label>{t('social_security_rate')}</label>
              <input
                type="number" min="0" max="1" step="0.001"
                value={settings.social_security_rate}
                onChange={(e) => setSettings({ ...settings, social_security_rate: Number(e.target.value) })}
              />
            </div>
            <div>
              <label>{t('tax_exempt_monthly')}</label>
              <input
                type="number" min="0" step="1000"
                value={settings.tax_exempt_monthly}
                onChange={(e) => setSettings({ ...settings, tax_exempt_monthly: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="section-title" style={{ marginTop: 8 }}>{t('tax_brackets')}</div>
          {settings.tax_brackets.map((b, idx) => (
            <div className="grid-3" key={idx}>
              <div>
                <label>{t('bracket_up_to')} #{idx + 1}</label>
                <input
                  type="number" min="0"
                  value={b.upTo ?? ''}
                  placeholder={t('no_limit')}
                  onChange={(e) => updateBracketUpTo(idx, e.target.value)}
                />
              </div>
              <div>
                <label>{t('bracket_rate')}</label>
                <input
                  type="number" min="0" max="1" step="0.001"
                  value={b.rate}
                  onChange={(e) => updateBracketRate(idx, e.target.value)}
                />
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit">{t('save')}</button>
            <button type="button" className="secondary" onClick={() => setShowSettings(false)}>{t('cancel')}</button>
          </div>
        </form>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">{t('total_net_salaries')}</div>
          <div className="stat-value">{fmt(totalNet)}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-label">{t('total_social_security')}</div>
          <div className="stat-value">{fmt(totalSocialSecurity)}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-label">{t('total_income_tax')}</div>
          <div className="stat-value">{fmt(totalIncomeTax)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('paid_count')}</div>
          <div className="stat-value">{paidCount}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-label">{t('pending_count')}</div>
          <div className="stat-value">{pendingCount}</div>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>{t('full_name')}</th>
              <th>{t('attendance')}</th>
              <th>{t('base_salary')}</th>
              <th>{t('allowances')}</th>
              <th>{t('deductions')}</th>
              <th>{t('social_security')}</th>
              <th>{t('income_tax')}</th>
              <th>{t('net_salary')}</th>
              <th>{t('status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {payrolls.map((p) => (
              <tr key={p.id}>
                <td>{p.User?.full_name}</td>
                <td className="muted" style={{ fontSize: 12 }}>
                  {t('present')}: {p.present_days} · {t('absent')}: {p.absent_days} · {t('late')}: {p.late_days}
                </td>
                <td>{fmt(p.base_salary)}</td>
                {editingId === p.id ? (
                  <>
                    <td>
                      <input
                        type="number" min="0" step="0.01"
                        value={draft.allowances}
                        onChange={(e) => setDraft({ ...draft, allowances: Number(e.target.value) })}
                        style={{ width: 80, marginBottom: 0 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number" min="0" step="0.01"
                        value={draft.deductions}
                        onChange={(e) => setDraft({ ...draft, deductions: Number(e.target.value) })}
                        style={{ width: 80, marginBottom: 0 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number" min="0" step="0.01"
                        value={draft.social_security_deduction}
                        onChange={(e) => setDraft({ ...draft, social_security_deduction: Number(e.target.value) })}
                        style={{ width: 80, marginBottom: 0 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number" min="0" step="0.01"
                        value={draft.income_tax_deduction}
                        onChange={(e) => setDraft({ ...draft, income_tax_deduction: Number(e.target.value) })}
                        style={{ width: 80, marginBottom: 0 }}
                      />
                    </td>
                    <td className="muted">{netPreview(p)}</td>
                  </>
                ) : (
                  <>
                    <td>{fmt(p.allowances)}</td>
                    <td>{fmt(p.deductions)}</td>
                    <td>{fmt(p.social_security_deduction)}</td>
                    <td>{fmt(p.income_tax_deduction)}</td>
                    <td style={{ fontWeight: 700 }}>{fmt(p.net_salary)}</td>
                  </>
                )}
                <td>
                  <span className={`badge ${p.status === 'paid' ? 'paid' : 'unpaid'}`}>
                    {p.status === 'paid' ? t('paid') : t('pending')}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="secondary" onClick={() => printPayslip(p)}>🖨️ {t('payslip')}</button>
                  {p.status !== 'paid' && editingId !== p.id && (
                    <>
                      <button className="secondary" onClick={() => startEdit(p)}>{t('edit')}</button>
                      <button onClick={() => payNow(p.id)}>{t('mark_paid')}</button>
                      {isAdmin && <button className="danger" onClick={() => removePayroll(p.id)}>{t('delete')}</button>}
                    </>
                  )}
                  {editingId === p.id && (
                    <>
                      <button onClick={() => saveEdit(p.id)}>{t('save')}</button>
                      <button className="secondary" onClick={() => setEditingId(null)}>{t('cancel')}</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {payrolls.length === 0 && (
              <tr><td colSpan={10} className="muted">{t('no_payroll_data')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

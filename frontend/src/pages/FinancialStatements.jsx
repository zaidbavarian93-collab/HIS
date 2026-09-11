import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { exportStyledExcel, printHtml } from '../utils/exportUtils';
import { formatMoney as fmt } from '../utils/format';

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

// نطاقات زمنية جاهزة: اليوم / هذا الأسبوع / هذا الشهر - أساس الترحيل اليومي والأسبوعي والشهري الداخلي
function presetRange(preset) {
  const now = new Date();
  const end = toISODate(now);
  if (preset === 'day') return { from: end, to: end };
  if (preset === 'week') {
    const day = now.getDay(); // الأحد = 0 في جافاسكربت
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

export default function FinancialStatements() {
  const { t } = useTranslation();
  const [preset, setPreset] = useState('month');
  const [range, setRange] = useState(presetRange('month'));
  const [trialBalance, setTrialBalance] = useState(null);
  const [incomeStatement, setIncomeStatement] = useState(null);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('trial_balance');

  function applyPreset(p) {
    setPreset(p);
    setRange(presetRange(p));
  }

  async function loadAll() {
    setLoading(true);
    try {
      const [tb, is, bs] = await Promise.all([
        api.get('/accounting/trial-balance', { params: { from: range.from, to: range.to } }),
        api.get('/accounting/income-statement', { params: { from: range.from, to: range.to } }),
        api.get('/accounting/balance-sheet', { params: { asOf: range.to } }),
      ]);
      setTrialBalance(tb.data);
      setIncomeStatement(is.data);
      setBalanceSheet(bs.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [range.from, range.to]);

  function exportTrialBalanceExcel() {
    if (!trialBalance) return;
    exportStyledExcel({
      filename: `ميزان_المراجعة_${range.from}_${range.to}`,
      sheetName: t('trial_balance'),
      reportTitle: `${t('trial_balance')} — ${range.from} إلى ${range.to}`,
      reportSubtitle: trialBalance.is_balanced ? t('balanced') : t('not_balanced'),
      columns: [
        { key: 'code', header: t('account_code') },
        { key: 'name_ar', header: t('account_name') },
        { key: 'opening_balance', header: t('opening_balance'), numFmt: '#,##0.00' },
        { key: 'period_debit', header: t('debit'), numFmt: '#,##0.00' },
        { key: 'period_credit', header: t('credit'), numFmt: '#,##0.00' },
        { key: 'closing_balance', header: t('closing_balance'), numFmt: '#,##0.00' },
      ],
      rows: trialBalance.rows,
      totalsRow: {
        code: '', name_ar: t('total'),
        opening_balance: trialBalance.totals.opening_balance,
        period_debit: trialBalance.totals.period_debit,
        period_credit: trialBalance.totals.period_credit,
        closing_balance: trialBalance.totals.closing_balance,
      },
    });
  }

  function exportIncomeStatementExcel() {
    if (!incomeStatement) return;
    const rows = [
      ...incomeStatement.revenue.map((r) => ({ code: r.code, name_ar: r.name_ar, section: t('account_type_revenue'), amount: r.amount })),
      ...incomeStatement.expense.map((r) => ({ code: r.code, name_ar: r.name_ar, section: t('account_type_expense'), amount: r.amount })),
    ];
    exportStyledExcel({
      filename: `قائمة_الدخل_${range.from}_${range.to}`,
      sheetName: t('income_statement'),
      reportTitle: `${t('income_statement')} — ${range.from} إلى ${range.to}`,
      reportSubtitle: `${t('net_result')}: ${fmt(incomeStatement.net_result)}`,
      columns: [
        { key: 'code', header: t('account_code') },
        { key: 'name_ar', header: t('account_name') },
        { key: 'section', header: t('account_type') },
        { key: 'amount', header: t('amount'), numFmt: '#,##0.00' },
      ],
      rows,
      totalsRow: { code: '', name_ar: t('net_result'), section: '', amount: incomeStatement.net_result },
    });
  }

  function exportBalanceSheetExcel() {
    if (!balanceSheet) return;
    const rows = [
      ...balanceSheet.assets.map((r) => ({ code: r.code, name_ar: r.name_ar, section: t('account_type_asset'), amount: r.amount })),
      ...balanceSheet.liabilities.map((r) => ({ code: r.code, name_ar: r.name_ar, section: t('account_type_liability'), amount: r.amount })),
      ...balanceSheet.equity.map((r) => ({ code: r.code, name_ar: r.name_ar, section: t('account_type_equity'), amount: r.amount })),
    ];
    exportStyledExcel({
      filename: `الميزانية_العمومية_${range.to}`,
      sheetName: t('balance_sheet'),
      reportTitle: `${t('balance_sheet')} — ${t('as_of')} ${range.to}`,
      reportSubtitle: balanceSheet.is_balanced ? t('balanced') : t('not_balanced'),
      columns: [
        { key: 'code', header: t('account_code') },
        { key: 'name_ar', header: t('account_name') },
        { key: 'section', header: t('account_type') },
        { key: 'amount', header: t('amount'), numFmt: '#,##0.00' },
      ],
      rows,
      totalsRow: {
        code: '', name_ar: t('total_assets'), section: `${t('total_liabilities')} + ${t('total_equity')}`,
        amount: balanceSheet.total_assets,
      },
    });
  }

  function printCurrentTab() {
    let title = '';
    let body = '';
    if (tab === 'trial_balance' && trialBalance) {
      title = t('trial_balance');
      body = `
        <h1>${title}</h1>
        <div class="meta">${range.from} → ${range.to} | ${trialBalance.is_balanced ? t('balanced') : t('not_balanced')}</div>
        <table>
          <thead><tr><th>${t('account_code')}</th><th>${t('account_name')}</th><th>${t('opening_balance')}</th><th>${t('debit')}</th><th>${t('credit')}</th><th>${t('closing_balance')}</th></tr></thead>
          <tbody>
            ${trialBalance.rows.map((r) => `<tr><td>${r.code}</td><td>${r.name_ar}</td><td>${fmt(r.opening_balance)}</td><td>${fmt(r.period_debit)}</td><td>${fmt(r.period_credit)}</td><td>${fmt(r.closing_balance)}</td></tr>`).join('')}
            <tr style="font-weight:700"><td colspan="2">${t('total')}</td><td>${fmt(trialBalance.totals.opening_balance)}</td><td>${fmt(trialBalance.totals.period_debit)}</td><td>${fmt(trialBalance.totals.period_credit)}</td><td>${fmt(trialBalance.totals.closing_balance)}</td></tr>
          </tbody>
        </table>`;
    } else if (tab === 'income_statement' && incomeStatement) {
      title = t('income_statement');
      body = `
        <h1>${title}</h1>
        <div class="meta">${range.from} → ${range.to}</div>
        <table>
          <thead><tr><th>${t('account_code')}</th><th>${t('account_name')}</th><th>${t('amount')}</th></tr></thead>
          <tbody>
            <tr><td colspan="3" style="font-weight:700;background:#f4f6f8">${t('account_type_revenue')}</td></tr>
            ${incomeStatement.revenue.map((r) => `<tr><td>${r.code}</td><td>${r.name_ar}</td><td>${fmt(r.amount)}</td></tr>`).join('')}
            <tr style="font-weight:700"><td colspan="2">${t('total_revenue')}</td><td>${fmt(incomeStatement.total_revenue)}</td></tr>
            <tr><td colspan="3" style="font-weight:700;background:#f4f6f8">${t('account_type_expense')}</td></tr>
            ${incomeStatement.expense.map((r) => `<tr><td>${r.code}</td><td>${r.name_ar}</td><td>${fmt(r.amount)}</td></tr>`).join('')}
            <tr style="font-weight:700"><td colspan="2">${t('total_expense')}</td><td>${fmt(incomeStatement.total_expense)}</td></tr>
            <tr style="font-weight:700"><td colspan="2">${t('net_result')}</td><td>${fmt(incomeStatement.net_result)}</td></tr>
          </tbody>
        </table>`;
    } else if (tab === 'balance_sheet' && balanceSheet) {
      title = t('balance_sheet');
      body = `
        <h1>${title}</h1>
        <div class="meta">${t('as_of')} ${range.to} | ${balanceSheet.is_balanced ? t('balanced') : t('not_balanced')}</div>
        <table>
          <thead><tr><th>${t('account_code')}</th><th>${t('account_name')}</th><th>${t('amount')}</th></tr></thead>
          <tbody>
            <tr><td colspan="3" style="font-weight:700;background:#f4f6f8">${t('account_type_asset')}</td></tr>
            ${balanceSheet.assets.map((r) => `<tr><td>${r.code}</td><td>${r.name_ar}</td><td>${fmt(r.amount)}</td></tr>`).join('')}
            <tr style="font-weight:700"><td colspan="2">${t('total_assets')}</td><td>${fmt(balanceSheet.total_assets)}</td></tr>
            <tr><td colspan="3" style="font-weight:700;background:#f4f6f8">${t('account_type_liability')}</td></tr>
            ${balanceSheet.liabilities.map((r) => `<tr><td>${r.code}</td><td>${r.name_ar}</td><td>${fmt(r.amount)}</td></tr>`).join('')}
            <tr style="font-weight:700"><td colspan="2">${t('total_liabilities')}</td><td>${fmt(balanceSheet.total_liabilities)}</td></tr>
            <tr><td colspan="3" style="font-weight:700;background:#f4f6f8">${t('account_type_equity')}</td></tr>
            ${balanceSheet.equity.map((r) => `<tr><td>${r.code}</td><td>${r.name_ar}</td><td>${fmt(r.amount)}</td></tr>`).join('')}
            <tr style="font-weight:700"><td colspan="2">${t('total_equity')}</td><td>${fmt(balanceSheet.total_equity)}</td></tr>
          </tbody>
        </table>`;
    }
    if (body) printHtml(title, body);
  }

  function exportCurrentTab() {
    if (tab === 'trial_balance') exportTrialBalanceExcel();
    else if (tab === 'income_statement') exportIncomeStatementExcel();
    else exportBalanceSheetExcel();
  }

  return (
    <div>
      <div className="topbar">
        <h2>{t('financial_statements')}</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="secondary" onClick={printCurrentTab}>🖨️ {t('print')}</button>
          <button onClick={exportCurrentTab}>📊 {t('export_excel')}</button>
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

      <div className="tag-list" style={{ marginBottom: 16 }}>
        <button type="button" className={tab === 'trial_balance' ? '' : 'secondary'} onClick={() => setTab('trial_balance')}>{t('trial_balance')}</button>
        <button type="button" className={tab === 'income_statement' ? '' : 'secondary'} onClick={() => setTab('income_statement')}>{t('income_statement')}</button>
        <button type="button" className={tab === 'balance_sheet' ? '' : 'secondary'} onClick={() => setTab('balance_sheet')}>{t('balance_sheet')}</button>
      </div>

      {loading && <div className="muted">{t('loading')}</div>}

      {!loading && tab === 'trial_balance' && trialBalance && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <div style={{ marginBottom: 10, fontWeight: 700, color: trialBalance.is_balanced ? 'var(--success-text)' : 'var(--danger-text)' }}>
            {trialBalance.is_balanced ? `✅ ${t('balanced')}` : `⚠️ ${t('not_balanced')}`}
          </div>
          <table>
            <thead>
              <tr>
                <th>{t('account_code')}</th><th>{t('account_name')}</th><th>{t('opening_balance')}</th>
                <th>{t('debit')}</th><th>{t('credit')}</th><th>{t('closing_balance')}</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.rows.map((r) => (
                <tr key={r.code}>
                  <td>{r.code}</td><td>{r.name_ar}</td><td>{fmt(r.opening_balance)}</td>
                  <td>{fmt(r.period_debit)}</td><td>{fmt(r.period_credit)}</td><td style={{ fontWeight: 700 }}>{fmt(r.closing_balance)}</td>
                </tr>
              ))}
              {trialBalance.rows.length === 0 && <tr><td colSpan={6} className="muted">{t('no_data')}</td></tr>}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={2}>{t('total')}</td>
                <td>{fmt(trialBalance.totals.opening_balance)}</td>
                <td>{fmt(trialBalance.totals.period_debit)}</td>
                <td>{fmt(trialBalance.totals.period_credit)}</td>
                <td>{fmt(trialBalance.totals.closing_balance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!loading && tab === 'income_statement' && incomeStatement && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <div className="stat-card">
              <div className="stat-label">{t('total_revenue')}</div>
              <div className="stat-value">{fmt(incomeStatement.total_revenue)}</div>
            </div>
            <div className="stat-card warn">
              <div className="stat-label">{t('total_expense')}</div>
              <div className="stat-value">{fmt(incomeStatement.total_expense)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t('net_result')}</div>
              <div className="stat-value">{fmt(incomeStatement.net_result)}</div>
            </div>
          </div>
          <table>
            <thead><tr><th>{t('account_code')}</th><th>{t('account_name')}</th><th>{t('amount')}</th></tr></thead>
            <tbody>
              <tr><td colSpan={3} style={{ fontWeight: 700, background: 'var(--primary-light)' }}>{t('account_type_revenue')}</td></tr>
              {incomeStatement.revenue.map((r) => <tr key={r.code}><td>{r.code}</td><td>{r.name_ar}</td><td>{fmt(r.amount)}</td></tr>)}
              <tr><td colSpan={3} style={{ fontWeight: 700, background: 'var(--primary-light)' }}>{t('account_type_expense')}</td></tr>
              {incomeStatement.expense.map((r) => <tr key={r.code}><td>{r.code}</td><td>{r.name_ar}</td><td>{fmt(r.amount)}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'balance_sheet' && balanceSheet && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <div style={{ marginBottom: 10, fontWeight: 700, color: balanceSheet.is_balanced ? 'var(--success-text)' : 'var(--danger-text)' }}>
            {balanceSheet.is_balanced ? `✅ ${t('balanced')}` : `⚠️ ${t('not_balanced')}`}
          </div>
          <table>
            <thead><tr><th>{t('account_code')}</th><th>{t('account_name')}</th><th>{t('amount')}</th></tr></thead>
            <tbody>
              <tr><td colSpan={3} style={{ fontWeight: 700, background: 'var(--primary-light)' }}>{t('account_type_asset')}</td></tr>
              {balanceSheet.assets.map((r) => <tr key={r.code}><td>{r.code}</td><td>{r.name_ar}</td><td>{fmt(r.amount)}</td></tr>)}
              <tr style={{ fontWeight: 700 }}><td colSpan={2}>{t('total_assets')}</td><td>{fmt(balanceSheet.total_assets)}</td></tr>
              <tr><td colSpan={3} style={{ fontWeight: 700, background: 'var(--primary-light)' }}>{t('account_type_liability')}</td></tr>
              {balanceSheet.liabilities.map((r) => <tr key={r.code}><td>{r.code}</td><td>{r.name_ar}</td><td>{fmt(r.amount)}</td></tr>)}
              <tr><td colSpan={3} style={{ fontWeight: 700, background: 'var(--primary-light)' }}>{t('account_type_equity')}</td></tr>
              {balanceSheet.equity.map((r) => <tr key={r.code}><td>{r.code}</td><td>{r.name_ar}</td><td>{fmt(r.amount)}</td></tr>)}
              <tr style={{ fontWeight: 700 }}><td colSpan={2}>{t('total_liabilities')} + {t('total_equity')}</td><td>{fmt(balanceSheet.total_liabilities + balanceSheet.total_equity)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

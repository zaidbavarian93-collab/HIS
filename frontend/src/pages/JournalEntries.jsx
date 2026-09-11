import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { formatMoney as fmt } from '../utils/format';

const REFERENCE_TYPES = ['invoice', 'payroll', 'insurance', 'inventory', 'manual'];
const emptyLine = { account_id: '', debit: 0, credit: 0 };

export default function JournalEntries() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState([{ ...emptyLine }, { ...emptyLine }]);
  const [error, setError] = useState('');

  async function loadEntries() {
    const { data } = await api.get('/accounting/journal-entries', { params: { reference_type: filterType || undefined } });
    setEntries(data);
  }

  useEffect(() => {
    loadEntries();
    api.get('/accounting/accounts').then((res) => setAccounts(res.data.filter((a) => !a.is_group)));
  }, [filterType]);

  function updateLine(idx, field, value) {
    const newLines = [...lines];
    newLines[idx][field] = value;
    setLines(newLines);
  }

  function addLine() {
    setLines([...lines, { ...emptyLine }]);
  }

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/accounting/journal-entries', { description, date, lines });
      setDescription('');
      setLines([{ ...emptyLine }, { ...emptyLine }]);
      setShowForm(false);
      loadEntries();
    } catch (err) {
      setError(err.response?.data?.message || t('save_failed'));
    }
  }

  return (
    <div>
      <div className="topbar">
        <h2>{t('journal_entries')}</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: 160, marginBottom: 0 }}>
            <option value="">{t('all_categories')}</option>
            {REFERENCE_TYPES.map((rt) => <option key={rt} value={rt}>{t(`ref_type_${rt}`)}</option>)}
          </select>
          <button onClick={() => setShowForm(!showForm)}>+ {t('add_manual_entry')}</button>
        </div>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleSubmit}>
          <div className="grid-2">
            <div>
              <label>{t('entry_description')}</label>
              <input required value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <label>{t('date')}</label>
              <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="section-title">{t('entry_lines')}</div>
          {lines.map((line, idx) => (
            <div key={idx} className="grid-3" style={{ marginBottom: 4 }}>
              <div>
                <select required value={line.account_id} onChange={(e) => updateLine(idx, 'account_id', e.target.value)}>
                  <option value="">{t('account_name')}</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name_ar}</option>)}
                </select>
              </div>
              <div>
                <input type="number" min="0" step="0.01" placeholder={t('debit')} value={line.debit} onChange={(e) => updateLine(idx, 'debit', Number(e.target.value))} />
              </div>
              <div>
                <input type="number" min="0" step="0.01" placeholder={t('credit')} value={line.credit} onChange={(e) => updateLine(idx, 'credit', Number(e.target.value))} />
              </div>
            </div>
          ))}
          <button type="button" className="secondary" onClick={addLine}>+ {t('add_line')}</button>

          <div style={{ margin: '14px 0', display: 'flex', gap: 20 }}>
            <div>{t('debit')}: <strong>{fmt(totalDebit)}</strong></div>
            <div>{t('credit')}: <strong>{fmt(totalCredit)}</strong></div>
            <div style={{ color: isBalanced ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 700 }}>
              {isBalanced ? t('balanced') : t('not_balanced')}
            </div>
          </div>

          {error && <div className="error-text">{error}</div>}
          <button type="submit" disabled={!isBalanced}>{t('post_entry')}</button>
        </form>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>{t('entry_number')}</th>
              <th>{t('date')}</th>
              <th>{t('entry_description')}</th>
              <th>{t('reference_type')}</th>
              <th>{t('amount')}</th>
              <th>{t('entry_lines')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((en) => (
              <tr key={en.id}>
                <td>{en.entry_number}</td>
                <td>{en.entry_date}</td>
                <td>{en.description}</td>
                <td><span className="badge active">{t(`ref_type_${en.reference_type}`)}</span></td>
                <td>{fmt(en.total_amount)}</td>
                <td className="muted" style={{ fontSize: 12 }}>
                  {en.lines.map((l) => `${l.Account?.code} ${l.Account?.name_ar} (${Number(l.debit) > 0 ? 'مدين ' + fmt(l.debit) : 'دائن ' + fmt(l.credit)})`).join(' · ')}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={6} className="muted">{t('no_data')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { formatMoney as fmt } from '../utils/format';
import { exportStyledExcel } from '../utils/exportUtils';

const emptyItem = { description: '', quantity: 1, unit_price: 0 };

export default function Billing() {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [items, setItems] = useState([{ ...emptyItem }]);

  const [insuranceCode, setInsuranceCode] = useState('');
  const [insuranceMember, setInsuranceMember] = useState(null);
  const [insuranceError, setInsuranceError] = useState('');

  async function loadInvoices() {
    const { data } = await api.get('/invoices');
    setInvoices(data);
  }

  useEffect(() => {
    loadInvoices();
    api.get('/patients').then((res) => setPatients(res.data));
  }, []);

  function updateItem(index, field, value) {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  }

  async function lookupInsurance() {
    setInsuranceError('');
    setInsuranceMember(null);
    if (!insuranceCode.trim()) return;
    try {
      const { data } = await api.get(`/insurance/members/lookup/${insuranceCode.trim()}`);
      if (data.status !== 'active') {
        setInsuranceError(t('insurance_not_active'));
        return;
      }
      setInsuranceMember(data);
    } catch (err) {
      setInsuranceError(err.response?.data?.message || t('insurance_not_found'));
    }
  }

  function clearInsurance() {
    setInsuranceMember(null);
    setInsuranceCode('');
    setInsuranceError('');
  }

  async function handleCreate(e) {
    e.preventDefault();
    await api.post('/invoices', {
      patient_id: patientId,
      items,
      insurance_member_id: insuranceMember?.id || null,
    });
    setShowForm(false);
    setItems([{ ...emptyItem }]);
    setPatientId('');
    clearInsurance();
    loadInvoices();
  }

  async function markPaid(id) {
    await api.put(`/invoices/${id}/pay`);
    loadInvoices();
  }

  function exportInvoicesExcel() {
    const rows = invoices.map((inv) => ({
      [t('invoice_number')]: inv.invoice_number,
      [t('patients')]: inv.Patient?.full_name || '',
      [t('total_amount')]: Number(inv.total_amount),
      [t('insurance_covers')]: Number(inv.insurance_covered_amount) || 0,
      [t('patient_payable')]: Number(inv.total_amount) - Number(inv.insurance_covered_amount),
      [t('status')]: t(inv.status),
    }));
    const totalAmount = invoices.reduce((s, inv) => s + Number(inv.total_amount), 0);
    const totalCovered = invoices.reduce((s, inv) => s + Number(inv.insurance_covered_amount), 0);
    exportStyledExcel({
      filename: 'الفواتير',
      sheetName: t('billing'),
      reportTitle: t('billing'),
      columns: [
        { key: t('invoice_number'), header: t('invoice_number') },
        { key: t('patients'), header: t('patients') },
        { key: t('total_amount'), header: t('total_amount'), numFmt: '#,##0.00' },
        { key: t('insurance_covers'), header: t('insurance_covers'), numFmt: '#,##0.00' },
        { key: t('patient_payable'), header: t('patient_payable'), numFmt: '#,##0.00' },
        { key: t('status'), header: t('status') },
      ],
      rows,
      totalsRow: {
        [t('invoice_number')]: t('total'),
        [t('patients')]: '',
        [t('total_amount')]: totalAmount,
        [t('insurance_covers')]: totalCovered,
        [t('patient_payable')]: totalAmount - totalCovered,
        [t('status')]: '',
      },
    });
  }

  const total = items.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unit_price || 0), 0);
  const coveredPreview = insuranceMember ? Math.round(total * (Number(insuranceMember.coverage_percentage) / 100) * 100) / 100 : 0;
  const payablePreview = total - coveredPreview;

  return (
    <div>
      <div className="topbar">
        <h2>{t('billing')}</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="secondary" onClick={exportInvoicesExcel} disabled={invoices.length === 0}>📊 {t('export_excel')}</button>
          <button onClick={() => setShowForm(!showForm)}>{t('new_invoice')}</button>
        </div>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleCreate}>
          <label>{t('patients')}</label>
          <select required value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">-</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.file_number})</option>)}
          </select>

          <div className="section-title">🛡️ {t('health_insurance')} <span className="muted">({t('optional')})</span></div>
          {insuranceMember ? (
            <div className="tag" style={{ marginBottom: 12 }}>
              {insuranceMember.full_name} — {insuranceMember.plan?.name_ar} ({insuranceMember.coverage_percentage}%)
              <button type="button" className="remove-tag" onClick={clearInsurance}>×</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <input
                placeholder={t('search_by_name_or_policy')}
                value={insuranceCode}
                onChange={(e) => setInsuranceCode(e.target.value)}
                style={{ marginBottom: 0 }}
              />
              <button type="button" className="secondary" onClick={lookupInsurance}>{t('search')}</button>
            </div>
          )}
          {insuranceError && <div className="error-text">{insuranceError}</div>}

          {items.map((item, idx) => (
            <div key={idx} className="grid-2" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
              <div>
                <label>{t('item_description')}</label>
                <input required value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
              </div>
              <div>
                <label>{t('quantity')}</label>
                <input required type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} />
              </div>
              <div>
                <label>{t('unit_price')}</label>
                <input required type="number" min="0" value={item.unit_price} onChange={(e) => updateItem(idx, 'unit_price', e.target.value)} />
              </div>
            </div>
          ))}
          <button type="button" className="secondary" onClick={() => setItems([...items, { ...emptyItem }])}>
            {t('add_item')}
          </button>

          <div style={{ margin: '14px 0' }}>
            <div style={{ fontWeight: 'bold' }}>{t('total_amount')}: {fmt(total)}</div>
            {insuranceMember && (
              <>
                <div className="muted">{t('insurance_covers')}: {fmt(coveredPreview)}</div>
                <div style={{ fontWeight: 'bold', color: 'var(--success-text)' }}>{t('patient_payable')}: {fmt(payablePreview)}</div>
              </>
            )}
          </div>
          <button type="submit">{t('save')}</button>
        </form>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('invoice_number')}</th>
              <th>{t('patients')}</th>
              <th>{t('total_amount')}</th>
              <th>{t('insurance_covers')}</th>
              <th>{t('patient_payable')}</th>
              <th>{t('status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.invoice_number}</td>
                <td>{inv.Patient?.full_name}</td>
                <td>{fmt(inv.total_amount)}</td>
                <td>{Number(inv.insurance_covered_amount) > 0 ? fmt(inv.insurance_covered_amount) : '-'}</td>
                <td>{fmt(Number(inv.total_amount) - Number(inv.insurance_covered_amount))}</td>
                <td><span className={`badge ${inv.status}`}>{t(inv.status)}</span></td>
                <td>
                  {inv.status === 'unpaid' && (
                    <button onClick={() => markPaid(inv.id)}>{t('mark_paid')}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

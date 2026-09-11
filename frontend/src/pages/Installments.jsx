import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatMoney as fmt } from '../utils/format';

const PLAN_STATUS_BADGE = { active: 'low-stock', completed: 'active', cancelled: 'inactive' };
const PAYMENT_STATUS_BADGE = { pending: 'low-stock', paid: 'active', overdue: 'inactive' };

export default function Installments() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [tab, setTab] = useState('plans');
  const [eligibleInvoices, setEligibleInvoices] = useState([]);
  const [plans, setPlans] = useState([]);
  const [expandedPlanId, setExpandedPlanId] = useState(null);
  const [creatingForInvoice, setCreatingForInvoice] = useState(null);
  const [form, setForm] = useState({ installments_count: 6, down_payment: 0, start_date: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState('');
  const [bankConfig, setBankConfig] = useState(null);
  const [showBankConfig, setShowBankConfig] = useState(false);
  const [bankTxns, setBankTxns] = useState({}); // { [paymentId]: txn }
  const [msg, setMsg] = useState('');

  async function loadEligible() {
    const { data } = await api.get('/installments/eligible-invoices');
    setEligibleInvoices(data);
  }
  async function loadPlans() {
    const { data } = await api.get('/installments');
    setPlans(data);
  }
  async function loadBankConfig() {
    const { data } = await api.get('/bank-gateway/config');
    setBankConfig(data);
  }
  async function loadBankTxns() {
    const { data } = await api.get('/bank-gateway/transactions');
    const map = {};
    data.forEach((t) => { map[t.installment_payment_id] = t; });
    setBankTxns(map);
  }

  useEffect(() => { loadEligible(); loadPlans(); loadBankConfig(); loadBankTxns(); }, []);

  function startCreate(invoice) {
    setCreatingForInvoice(invoice);
    setError('');
    setForm({ installments_count: 6, down_payment: 0, start_date: new Date().toISOString().slice(0, 10) });
  }

  async function submitCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/installments', { invoice_id: creatingForInvoice.id, ...form });
      setCreatingForInvoice(null);
      loadEligible();
      loadPlans();
      setTab('plans');
    } catch (err) {
      setError(err.response?.data?.message || t('save_failed'));
    }
  }

  async function payCash(paymentId) {
    await api.put(`/installments/payments/${paymentId}/pay`);
    loadPlans();
  }

  async function initiateBankPayment(paymentId) {
    const { data } = await api.post(`/bank-gateway/initiate/${paymentId}`);
    setBankTxns({ ...bankTxns, [paymentId]: data });
  }

  async function simulateBankConfirm(referenceNumber) {
    setMsg('');
    try {
      await api.post(`/bank-gateway/simulate-confirm/${referenceNumber}`);
      setMsg(t('bank_confirm_success'));
      loadPlans();
      loadBankTxns();
    } catch (err) {
      setMsg(err.response?.data?.message || t('save_failed'));
    }
  }

  async function cancelPlan(planId) {
    await api.put(`/installments/${planId}/cancel`);
    loadPlans();
    loadEligible();
  }

  async function regenerateBankKey() {
    await api.put('/bank-gateway/config/regenerate-key');
    loadBankConfig();
  }

  const patientPortion = creatingForInvoice ? Number(creatingForInvoice.total_amount) - Number(creatingForInvoice.insurance_covered_amount) : 0;
  const previewRemaining = patientPortion - Number(form.down_payment || 0);
  const previewInstallment = form.installments_count > 0 ? Math.floor((previewRemaining / form.installments_count) * 100) / 100 : 0;

  return (
    <div>
      <div className="topbar">
        <h2>💳 {t('installments_platform')}</h2>
        {isAdmin && <button className="secondary" onClick={() => setShowBankConfig(!showBankConfig)}>🏦 {t('bank_gateway_settings')}</button>}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">{t('installments_hint_title')}</div>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.8 }}>{t('installments_hint_body')}</p>
      </div>

      {showBankConfig && bankConfig && isAdmin && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title">🏦 {bankConfig.bank_name_ar} ({bankConfig.bank_name_en})</div>
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.8 }}>{t('bank_gateway_hint')}</p>
          <div className="grid-3">
            <div><label>{t('hospital_account_number')}</label><input readOnly value={bankConfig.hospital_account_number} /></div>
            <div><label>{t('api_key')}</label><input readOnly value={bankConfig.api_key_full || bankConfig.api_key_masked} /></div>
            <div><label>{t('webhook_endpoint')}</label><input readOnly value="POST /api/bank-gateway/webhook" /></div>
          </div>
          <button type="button" className="danger" onClick={regenerateBankKey}>{t('regenerate_key')}</button>
        </div>
      )}

      <div className="tag-list" style={{ marginBottom: 16 }}>
        <button type="button" className={tab === 'plans' ? '' : 'secondary'} onClick={() => setTab('plans')}>{t('installment_plans')}</button>
        <button type="button" className={tab === 'eligible' ? '' : 'secondary'} onClick={() => setTab('eligible')}>{t('eligible_invoices')}</button>
      </div>

      {msg && <div className="card muted">{msg}</div>}

      {tab === 'eligible' && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{t('eligible_invoices_hint')}</div>
          <table>
            <thead>
              <tr>
                <th>{t('invoice_number')}</th>
                <th>{t('patients')}</th>
                <th>{t('total_amount')}</th>
                <th>{t('patient_payable')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {eligibleInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.invoice_number}</td>
                  <td>{inv.Patient?.full_name}</td>
                  <td>{fmt(inv.total_amount)}</td>
                  <td style={{ fontWeight: 700 }}>{fmt(Number(inv.total_amount) - Number(inv.insurance_covered_amount))}</td>
                  <td><button type="button" onClick={() => startCreate(inv)}>+ {t('create_installment_plan')}</button></td>
                </tr>
              ))}
              {eligibleInvoices.length === 0 && <tr><td colSpan={5} className="muted">{t('no_data')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {creatingForInvoice && (
        <form className="card" onSubmit={submitCreate} style={{ marginTop: 16 }}>
          <div className="section-title">{t('create_installment_plan')} — {creatingForInvoice.invoice_number}</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{t('patient_payable')}: <strong>{fmt(patientPortion)}</strong></div>
          <div className="grid-3">
            <div>
              <label>{t('down_payment')}</label>
              <input type="number" min="0" max={patientPortion - 1} value={form.down_payment} onChange={(e) => setForm({ ...form, down_payment: Number(e.target.value) })} />
            </div>
            <div>
              <label>{t('installments_count')}</label>
              <input type="number" min="1" max="36" value={form.installments_count} onChange={(e) => setForm({ ...form, installments_count: Number(e.target.value) })} />
            </div>
            <div>
              <label>{t('start_date')}</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
          </div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            {t('installment_preview', { amount: fmt(previewInstallment), count: form.installments_count })}
          </div>
          {error && <div className="error-text">{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit">{t('save')}</button>
            <button type="button" className="secondary" onClick={() => setCreatingForInvoice(null)}>{t('cancel')}</button>
          </div>
        </form>
      )}

      {tab === 'plans' && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{t('plan_number')}</th>
                <th>{t('patients')}</th>
                <th>{t('total_amount')}</th>
                <th>{t('progress')}</th>
                <th>{t('status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const paidCount = plan.payments.filter((p) => p.status === 'paid').length;
                const isExpanded = expandedPlanId === plan.id;
                return (
                  <>
                    <tr key={plan.id}>
                      <td>{plan.plan_number}</td>
                      <td>{plan.Patient?.full_name}</td>
                      <td>{fmt(plan.total_amount)}</td>
                      <td>{paidCount} / {plan.payments.length}</td>
                      <td><span className={`badge ${PLAN_STATUS_BADGE[plan.status]}`}>{t(`installment_status_${plan.status}`)}</span></td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="secondary" onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}>
                          {isExpanded ? t('close') : t('view_schedule')}
                        </button>
                        {isAdmin && plan.status === 'active' && (
                          <button type="button" className="danger" onClick={() => cancelPlan(plan.id)}>{t('cancel')}</button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6}>
                          <table style={{ marginBottom: 0 }}>
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>{t('due_date')}</th>
                                <th>{t('amount')}</th>
                                <th>{t('status')}</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {plan.payments.map((p) => {
                                const txn = bankTxns[p.id];
                                return (
                                  <tr key={p.id}>
                                    <td>{p.installment_number === 0 ? t('down_payment') : p.installment_number}</td>
                                    <td>{p.due_date}</td>
                                    <td>{fmt(p.amount)}</td>
                                    <td><span className={`badge ${PAYMENT_STATUS_BADGE[p.status]}`}>{t(`payment_status_${p.status}`)}</span></td>
                                    <td>
                                      {p.status !== 'paid' && (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                          <button type="button" onClick={() => payCash(p.id)}>💵 {t('pay_cash')}</button>
                                          {!txn && (
                                            <button type="button" className="secondary" onClick={() => initiateBankPayment(p.id)}>🏦 {t('pay_via_bank')}</button>
                                          )}
                                          {txn && txn.status === 'initiated' && (
                                            <span className="tag">
                                              {t('reference')}: {txn.reference_number}
                                              <button type="button" className="secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => simulateBankConfirm(txn.reference_number)}>
                                                ⚡ {t('simulate_bank_confirm')}
                                              </button>
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
              {plans.length === 0 && <tr><td colSpan={6} className="muted">{t('no_data')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

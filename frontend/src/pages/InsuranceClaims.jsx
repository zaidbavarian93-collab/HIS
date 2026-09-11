import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { formatMoney } from '../utils/format';

const STATUSES = ['submitted', 'under_review', 'approved', 'partially_approved', 'rejected', 'paid'];
const STATUS_BADGE = {
  submitted: 'low-stock', under_review: 'low-stock', approved: 'active',
  partially_approved: 'active', rejected: 'inactive', paid: 'active',
};

export default function InsuranceClaims() {
  const { t } = useTranslation();
  const [claims, setClaims] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [msg, setMsg] = useState('');

  async function loadClaims() {
    const { data } = await api.get('/claims', { params: { status: statusFilter || undefined } });
    setClaims(data);
  }

  useEffect(() => { loadClaims(); }, [statusFilter]);

  async function markPaid(claim) {
    try {
      await api.put(`/claims/${claim.id}/mark-paid`);
      setMsg(t('claim_settled_success'));
      loadClaims();
    } catch (err) {
      setMsg(err.response?.data?.message || t('save_failed'));
    }
  }

  const totalClaimed = claims.reduce((s, c) => s + Number(c.amount_claimed), 0);
  const totalApproved = claims.reduce((s, c) => s + Number(c.amount_approved || 0), 0);
  const totalPaid = claims.filter((c) => c.status === 'paid').reduce((s, c) => s + Number(c.amount_approved ?? c.amount_claimed), 0);

  return (
    <div>
      <div className="topbar">
        <h2>📋 {t('insurance_claims')}</h2>
      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">{t('total_claimed')}</div>
          <div className="stat-value">{formatMoney(totalClaimed)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('total_approved')}</div>
          <div className="stat-value">{formatMoney(totalApproved)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('total_settled')}</div>
          <div className="stat-value">{formatMoney(totalPaid)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="tag-list" style={{ marginBottom: 0 }}>
          <button type="button" className={statusFilter === '' ? '' : 'secondary'} onClick={() => setStatusFilter('')}>{t('all_categories')}</button>
          {STATUSES.map((s) => (
            <button key={s} type="button" className={statusFilter === s ? '' : 'secondary'} onClick={() => setStatusFilter(s)}>{t(`claim_status_${s}`)}</button>
          ))}
        </div>
      </div>

      {msg && <div className="card muted">{msg}</div>}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>{t('claim_number')}</th>
              <th>{t('insurance_company')}</th>
              <th>{t('visitor_name')}</th>
              <th>{t('invoice_number')}</th>
              <th>{t('amount_claimed')}</th>
              <th>{t('amount_approved')}</th>
              <th>{t('status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id}>
                <td>{c.claim_number}</td>
                <td>{c.InsuranceCompany?.name_ar}</td>
                <td>{c.InsuranceMember?.full_name}</td>
                <td>{c.Invoice?.invoice_number}</td>
                <td>{formatMoney(c.amount_claimed)}</td>
                <td>{c.amount_approved !== null ? formatMoney(c.amount_approved) : '-'}</td>
                <td><span className={`badge ${STATUS_BADGE[c.status]}`}>{t(`claim_status_${c.status}`)}</span></td>
                <td>
                  {['approved', 'partially_approved'].includes(c.status) && (
                    <button type="button" onClick={() => markPaid(c)}>💵 {t('mark_settled')}</button>
                  )}
                </td>
              </tr>
            ))}
            {claims.length === 0 && <tr><td colSpan={8} className="muted">{t('no_data')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

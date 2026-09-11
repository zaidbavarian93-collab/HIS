import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const emptyForm = { name_ar: '', name_en: '', contact_person: '', phone: '', email: '', address: '', notes: '' };

export default function InsuranceCompanies() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [companies, setCompanies] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [revealedKeyId, setRevealedKeyId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  async function loadCompanies() {
    const { data } = await api.get('/insurance-companies');
    setCompanies(data);
  }

  useEffect(() => { loadCompanies(); }, []);

  async function addCompany(e) {
    e.preventDefault();
    await api.post('/insurance-companies', form);
    setForm(emptyForm);
    setShowForm(false);
    loadCompanies();
  }

  async function toggleActive(c) {
    await api.put(`/insurance-companies/${c.id}`, { is_active: !c.is_active });
    loadCompanies();
  }

  async function regenerateKey(c) {
    await api.put(`/insurance-companies/${c.id}/regenerate-key`);
    loadCompanies();
  }

  function copyKey(c) {
    navigator.clipboard?.writeText(c.api_key);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div>
      <div className="topbar">
        <h2>🏢 {t('insurance_companies')}</h2>
        {isAdmin && <button onClick={() => setShowForm(!showForm)}>+ {t('add_insurance_company')}</button>}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">{t('claims_engine_title')}</div>
        <p style={{ lineHeight: 1.8, fontSize: 13.5 }} className="muted">{t('claims_engine_body')}</p>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
          {t('api_endpoints_hint')}: <code>GET /api/insurer-portal/verify-coverage</code>, <code>GET /api/insurer-portal/claims</code>, <code>PUT /api/insurer-portal/claims/:id/respond</code>
        </div>
      </div>

      {showForm && isAdmin && (
        <form className="card" onSubmit={addCompany}>
          <div className="grid-3">
            <div><label>{t('company_name_ar')}</label><input required value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></div>
            <div><label>{t('company_name_en')}</label><input required value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
            <div><label>{t('contact_person')}</label><input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
            <div><label>{t('phone')}</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label>{t('email')}</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label>{t('address')}</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <button type="submit">{t('save')}</button>
        </form>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>{t('company_name_ar')}</th>
              <th>{t('contact_person')}</th>
              <th>{t('phone')}</th>
              <th>{t('email')}</th>
              <th>{t('api_key')}</th>
              <th>{t('status')}</th>
              {isAdmin && <th></th>}
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id}>
                <td>{c.name_ar}<div className="muted" style={{ fontSize: 11 }}>{c.name_en}</div></td>
                <td>{c.contact_person || '-'}</td>
                <td>{c.phone || '-'}</td>
                <td>{c.email || '-'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <code style={{ fontSize: 11 }}>
                      {revealedKeyId === c.id ? c.api_key : `${c.api_key.slice(0, 8)}${'•'.repeat(16)}`}
                    </code>
                    <button type="button" className="secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setRevealedKeyId(revealedKeyId === c.id ? null : c.id)}>
                      {revealedKeyId === c.id ? '🙈' : '👁️'}
                    </button>
                    <button type="button" className="secondary" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => copyKey(c)}>
                      {copiedId === c.id ? '✓' : '📋'}
                    </button>
                  </div>
                </td>
                <td><span className={`badge ${c.is_active ? 'active' : 'inactive'}`}>{c.is_active ? t('active_status') : t('inactive_status')}</span></td>
                {isAdmin && (
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="secondary" onClick={() => toggleActive(c)}>{c.is_active ? t('deactivate') : t('activate')}</button>
                    <button type="button" className="danger" onClick={() => regenerateKey(c)}>{t('regenerate_key')}</button>
                  </td>
                )}
              </tr>
            ))}
            {companies.length === 0 && <tr><td colSpan={7} className="muted">{t('no_data')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

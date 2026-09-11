import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const emptyForm = {
  full_name: '',
  phone: '',
  national_id: '',
  date_of_birth: '',
  gender: 'male',
  address: '',
  blood_type: '',
};

export default function Patients() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const canRegister = ['admin', 'reception'].includes(user?.role);

  async function loadPatients(q = '') {
    const { data } = await api.get('/patients', { params: { search: q } });
    setPatients(data);
  }

  useEffect(() => {
    loadPatients();
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    loadPatients(search);
  }

  async function handleAdd(e) {
    e.preventDefault();
    await api.post('/patients', form);
    setForm(emptyForm);
    setShowForm(false);
    loadPatients();
  }

  return (
    <div>
      <div className="topbar">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, flex: 1, maxWidth: 420 }}>
          <input
            placeholder={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 0 }}
          />
          <button type="submit">{t('search')}</button>
        </form>
        {canRegister && (
          <button onClick={() => setShowForm(!showForm)}>{t('add_patient')}</button>
        )}
      </div>

      {showForm && (
        <form className="card" onSubmit={handleAdd}>
          <div className="grid-2">
            <div>
              <label>{t('full_name')}</label>
              <input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <label>{t('phone')}</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label>{t('national_id')}</label>
              <input
                value={form.national_id}
                onChange={(e) => setForm({ ...form, national_id: e.target.value })}
              />
            </div>
            <div>
              <label>{t('date_of_birth')}</label>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
              />
            </div>
            <div>
              <label>{t('gender')}</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="male">{t('male')}</option>
                <option value="female">{t('female')}</option>
              </select>
            </div>
            <div>
              <label>{t('address')}</label>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div>
              <label>{t('blood_type')}</label>
              <select value={form.blood_type} onChange={(e) => setForm({ ...form, blood_type: e.target.value })}>
                <option value="">-</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>{t('more_health_details_hint')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit">{t('save')}</button>
            <button type="button" className="secondary" onClick={() => setShowForm(false)}>
              {t('cancel')}
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('file_number')}</th>
              <th>{t('full_name')}</th>
              <th>{t('phone')}</th>
              <th>{t('gender')}</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.id}>
                <td>{p.file_number}</td>
                <td>
                  <Link to={`/patients/${p.id}`}>{p.full_name}</Link>
                </td>
                <td>{p.phone || '-'}</td>
                <td>{p.gender ? t(p.gender) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

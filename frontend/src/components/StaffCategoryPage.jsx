import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import StaffForm from './StaffForm';

// صفحة عامة لعرض وإدارة فئة موظفين محددة (أطباء الأسنان والصيادلة / التقنيون / الإداريون)
// كل فئة صفحة مستقلة بذاتها، معزولة تمامًا عن باقي الفئات
export default function StaffCategoryPage({ titleKey, roleOptions, addLabelKey }) {
  const { t } = useTranslation();
  const [staff, setStaff] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  async function loadStaff() {
    const { data } = await api.get('/users');
    setStaff(data.filter((u) => roleOptions.includes(u.role)));
  }

  useEffect(() => { loadStaff(); }, []);

  function handleSaved() {
    setShowForm(false);
    setEditingUser(null);
    loadStaff();
  }

  async function toggleActive(u) {
    await api.put(`/users/${u.id}`, { is_active: !u.is_active });
    loadStaff();
  }

  async function downloadCertificate(u) {
    const res = await api.get(`/users/${u.id}/certificate`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', u.certificate_original_name || 'certificate');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="topbar">
        <h2>{t(titleKey)}</h2>
        <button onClick={() => { setEditingUser(null); setShowForm(!showForm); }}>
          + {t(addLabelKey)}
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">{t('total_staff_in_category')}</div>
          <div className="stat-value">{staff.length}</div>
        </div>
      </div>

      {showForm && !editingUser && (
        <StaffForm roleOptions={roleOptions} onSaved={handleSaved} onCancel={() => setShowForm(false)} />
      )}
      {editingUser && (
        <StaffForm roleOptions={roleOptions} existingUser={editingUser} onSaved={handleSaved} onCancel={() => setEditingUser(null)} />
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('full_name')}</th>
              <th>{t('username')}</th>
              <th>{t('role_label')}</th>
              <th>{t('job_grade')}</th>
              <th>{t('phone')}</th>
              <th>{t('base_salary')}</th>
              <th>{t('certificate_upload')}</th>
              <th>{t('status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name}</td>
                <td>{u.username}</td>
                <td>{t(`role_${u.role}`)}</td>
                <td>{u.job_grade || '-'}</td>
                <td>{u.phone || '-'}</td>
                <td>{u.base_salary}</td>
                <td>
                  {u.certificate_file ? (
                    <button className="secondary" onClick={() => downloadCertificate(u)}>⬇️ {t('download')}</button>
                  ) : (
                    <span className="muted">{t('no_certificate')}</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${u.is_active ? 'active' : 'inactive'}`}>
                    {u.is_active ? t('active_status') : t('inactive_status')}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="secondary" onClick={() => { setShowForm(false); setEditingUser(u); }}>{t('edit')}</button>
                  <button className="secondary" onClick={() => toggleActive(u)}>
                    {u.is_active ? t('deactivate') : t('activate')}
                  </button>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr><td colSpan={9} className="muted">{t('no_data')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

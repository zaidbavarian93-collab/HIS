import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import StaffForm from '../components/StaffForm';
import { formatMoney } from '../utils/format';

export default function Users() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  async function loadUsers() {
    const { data } = await api.get('/users');
    setUsers(data);
  }

  useEffect(() => { loadUsers(); }, []);

  function handleSaved() {
    setShowForm(false);
    setEditingUser(null);
    loadUsers();
  }

  async function toggleActive(u) {
    await api.put(`/users/${u.id}`, { is_active: !u.is_active });
    loadUsers();
  }

  async function toggleDeptHead(u) {
    await api.put(`/users/${u.id}`, { is_department_head: !u.is_department_head });
    loadUsers();
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
        <h2>{t('users')}</h2>
        <button onClick={() => { setEditingUser(null); setShowForm(!showForm); }}>
          + {t('add_staff')}
        </button>
      </div>

      {showForm && !editingUser && (
        <StaffForm onSaved={handleSaved} onCancel={() => setShowForm(false)} />
      )}

      {editingUser && (
        <StaffForm existingUser={editingUser} onSaved={handleSaved} onCancel={() => setEditingUser(null)} />
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
              <th>{t('department_head')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name}</td>
                <td>{u.username}</td>
                <td>{t(`role_${u.role}`)}</td>
                <td>{u.job_grade || '-'}</td>
                <td>{u.phone || '-'}</td>
                <td>{formatMoney(u.base_salary)}</td>
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
                <td>
                  <button
                    type="button"
                    className={u.is_department_head ? '' : 'secondary'}
                    onClick={() => toggleDeptHead(u)}
                    title={t('department_head_hint')}
                  >
                    {u.is_department_head ? `✓ ${t('yes')}` : t('grant')}
                  </button>
                </td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="secondary" onClick={() => { setShowForm(false); setEditingUser(u); }}>{t('edit')}</button>
                  <button className="secondary" onClick={() => toggleActive(u)}>
                    {u.is_active ? t('deactivate') : t('activate')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

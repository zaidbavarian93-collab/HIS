import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const STATUSES = ['present', 'late', 'absent', 'leave'];
const emptyForm = { user_id: '', date: todayStr(), status: 'absent', notes: '' };

export default function Attendance() {
  const { t } = useTranslation();
  const [month, setMonth] = useState(currentMonth());
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterUser, setFilterUser] = useState('');

  async function loadAll() {
    const [attRes, usersRes] = await Promise.all([
      api.get('/attendance', { params: { month, user_id: filterUser || undefined } }),
      api.get('/users'),
    ]);
    setRecords(attRes.data);
    setEmployees(usersRes.data);
  }

  useEffect(() => { loadAll(); }, [month, filterUser]);

  async function handleAdd(e) {
    e.preventDefault();
    await api.post('/attendance', form);
    setForm({ ...emptyForm, date: todayStr() });
    setShowForm(false);
    loadAll();
  }

  async function removeRecord(id) {
    await api.delete(`/attendance/${id}`);
    loadAll();
  }

  function statusBadgeClass(status) {
    if (status === 'present') return 'active';
    if (status === 'late') return 'low-stock';
    if (status === 'absent') return 'out-of-stock';
    return 'booked';
  }

  const summary = records.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    { present: 0, late: 0, absent: 0, leave: 0 }
  );

  return (
    <div>
      <div className="topbar">
        <h2>{t('attendance_management')}</h2>
        <button onClick={() => setShowForm(!showForm)}>+ {t('add_record_manual')}</button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">{t('present')}</div>
          <div className="stat-value">{summary.present}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-label">{t('late')}</div>
          <div className="stat-value">{summary.late}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-label">{t('absent')}</div>
          <div className="stat-value">{summary.absent}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('leave')}</div>
          <div className="stat-value">{summary.leave}</div>
        </div>
      </div>

      {showForm && (
        <form className="card" onSubmit={handleAdd}>
          <div className="grid-3">
            <div>
              <label>{t('employee')}</label>
              <select required value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
                <option value="">-</option>
                {employees.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label>{t('date')}</label>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label>{t('status')}</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label>{t('notes')}</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="submit">{t('save')}</button>
        </form>
      )}

      <div className="topbar" style={{ marginTop: 4 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 160, marginBottom: 0 }} />
          <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} style={{ width: 200, marginBottom: 0 }}>
            <option value="">{t('all_employees')}</option>
            {employees.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('date')}</th>
              <th>{t('employee')}</th>
              <th>{t('check_in')}</th>
              <th>{t('check_out')}</th>
              <th>{t('status')}</th>
              <th>{t('notes')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td>{r.User?.full_name}</td>
                <td>{r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td>{r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td><span className={`badge ${statusBadgeClass(r.status)}`}>{t(r.status)}</span></td>
                <td className="muted">{r.notes || '-'}</td>
                <td><button className="danger" onClick={() => removeRecord(r.id)}>{t('delete')}</button></td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr><td colSpan={7} className="muted">{t('no_data')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

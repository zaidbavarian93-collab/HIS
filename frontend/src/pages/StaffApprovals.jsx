import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const REQUEST_TYPES = ['add', 'edit', 'transfer', 'delete'];

const emptyAddForm = { full_name: '', username: '', role: '', job_grade: '', phone: '', email: '' };

export default function StaffApprovals() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isDeptHead = !!user?.is_department_head;

  const [requests, setRequests] = useState([]);
  const [departmentStaff, setDepartmentStaff] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [statusFilter, setStatusFilter] = useState(isAdmin ? 'pending' : '');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // نموذج تقديم طلب جديد (رئيس القسم)
  const [requestType, setRequestType] = useState('add');
  const [targetUserId, setTargetUserId] = useState('');
  const [newDepartmentId, setNewDepartmentId] = useState('');
  const [editFields, setEditFields] = useState({ full_name: '', phone: '', email: '', job_grade: '' });
  const [addForm, setAddForm] = useState(emptyAddForm);

  // نموذج الموافقة (مدير النظام)
  const [approvingId, setApprovingId] = useState(null);
  const [approvePassword, setApprovePassword] = useState('');
  const [approveSalary, setApproveSalary] = useState('');
  const [rejectingId, setRejectingId] = useState(null);
  const [reviewNote, setReviewNote] = useState('');

  async function loadRequests() {
    const { data } = await api.get('/staff-requests', { params: { status: statusFilter || undefined } });
    setRequests(data);
  }

  useEffect(() => { loadRequests(); }, [statusFilter]);

  useEffect(() => {
    if (isDeptHead) {
      api.get('/users/department-staff').then((res) => setDepartmentStaff(res.data));
    }
    api.get('/departments').then((res) => setDepartments(res.data));
  }, [isDeptHead]);

  async function submitRequest(e) {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      let payload = {};
      if (requestType === 'add') payload = addForm;
      else if (requestType === 'edit') {
        // الحقول الفارغة تعني "أبقِ القيمة القديمة" - لا تُرسَل أصلًا
        payload = Object.fromEntries(Object.entries(editFields).filter(([, v]) => v !== ''));
        if (Object.keys(payload).length === 0) {
          setError(t('nothing_to_edit'));
          return;
        }
      } else if (requestType === 'transfer') payload = { new_department_id: newDepartmentId };

      await api.post('/staff-requests', {
        request_type: requestType,
        target_user_id: requestType === 'add' ? undefined : targetUserId,
        payload,
      });
      setMsg(t('request_submitted_success'));
      setTargetUserId('');
      setNewDepartmentId('');
      setEditFields({ full_name: '', phone: '', email: '', job_grade: '' });
      setAddForm(emptyAddForm);
      loadRequests();
    } catch (err) {
      setError(err.response?.data?.message || t('save_failed'));
    }
  }

  async function approve(reqItem) {
    setError('');
    try {
      const body = {};
      if (reqItem.request_type === 'add') {
        if (!approvePassword || approvePassword.length < 6) {
          setError(t('password_required_on_approve'));
          return;
        }
        body.password = approvePassword;
      }
      if (approveSalary !== '') body.base_salary_override = Number(approveSalary);
      await api.put(`/staff-requests/${reqItem.id}/approve`, body);
      setApprovingId(null);
      setApprovePassword('');
      setApproveSalary('');
      loadRequests();
    } catch (err) {
      setError(err.response?.data?.message || t('save_failed'));
    }
  }

  async function reject(reqItem) {
    setError('');
    try {
      await api.put(`/staff-requests/${reqItem.id}/reject`, { review_note: reviewNote });
      setRejectingId(null);
      setReviewNote('');
      loadRequests();
    } catch (err) {
      setError(err.response?.data?.message || t('save_failed'));
    }
  }

  const statusBadgeClass = { pending: 'inactive', approved: 'active', rejected: 'inactive' };

  return (
    <div>
      <div className="topbar">
        <h2>{t('staff_approvals')}</h2>
      </div>

      {isDeptHead && (
        <form className="card" onSubmit={submitRequest} style={{ marginBottom: 20 }}>
          <div className="section-title">{t('submit_new_request')}</div>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{t('staff_request_hint')}</div>

          <div className="grid-3">
            <div>
              <label>{t('request_type')}</label>
              <select value={requestType} onChange={(e) => setRequestType(e.target.value)}>
                {REQUEST_TYPES.map((rt) => <option key={rt} value={rt}>{t(`request_type_${rt}`)}</option>)}
              </select>
            </div>

            {requestType !== 'add' && (
              <div>
                <label>{t('target_staff')}</label>
                <select required value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}>
                  <option value="">-</option>
                  {departmentStaff.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({t(`role_${s.role}`)})</option>)}
                </select>
              </div>
            )}

            {requestType === 'transfer' && (
              <div>
                <label>{t('new_department')}</label>
                <select required value={newDepartmentId} onChange={(e) => setNewDepartmentId(e.target.value)}>
                  <option value="">-</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name_ar}</option>)}
                </select>
              </div>
            )}
          </div>

          {requestType === 'edit' && (
            <div className="grid-3" style={{ marginTop: 10 }}>
              <div><label>{t('full_name')}</label><input value={editFields.full_name} onChange={(e) => setEditFields({ ...editFields, full_name: e.target.value })} placeholder={t('leave_blank_keep')} /></div>
              <div><label>{t('phone')}</label><input value={editFields.phone} onChange={(e) => setEditFields({ ...editFields, phone: e.target.value })} placeholder={t('leave_blank_keep')} /></div>
              <div><label>{t('email')}</label><input value={editFields.email} onChange={(e) => setEditFields({ ...editFields, email: e.target.value })} placeholder={t('leave_blank_keep')} /></div>
              <div><label>{t('job_grade')}</label><input value={editFields.job_grade} onChange={(e) => setEditFields({ ...editFields, job_grade: e.target.value })} placeholder={t('leave_blank_keep')} /></div>
            </div>
          )}

          {requestType === 'add' && (
            <div className="grid-3" style={{ marginTop: 10 }}>
              <div><label>{t('full_name')} *</label><input required value={addForm.full_name} onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })} /></div>
              <div><label>{t('username')} *</label><input required value={addForm.username} onChange={(e) => setAddForm({ ...addForm, username: e.target.value })} /></div>
              <div>
                <label>{t('role_label')} *</label>
                <input required list="request-role-suggestions" value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })} placeholder={t('role_free_text_hint')} />
                <datalist id="request-role-suggestions">
                  <option value="doctor" /><option value="nurse" /><option value="dentist" /><option value="pharmacy" />
                  <option value="anesthesia_tech" /><option value="radiology_tech" /><option value="lab" /><option value="administrative" /><option value="worker" />
                </datalist>
              </div>
              <div><label>{t('job_grade')}</label><input value={addForm.job_grade} onChange={(e) => setAddForm({ ...addForm, job_grade: e.target.value })} /></div>
              <div><label>{t('phone')}</label><input value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} /></div>
              <div><label>{t('email')}</label><input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} /></div>
            </div>
          )}

          {error && <div className="error-text" style={{ marginTop: 10 }}>{error}</div>}
          {msg && <div style={{ marginTop: 10, color: 'var(--success-text)', fontWeight: 700 }}>{msg}</div>}
          <button type="submit" style={{ marginTop: 14 }}>{t('submit_request')}</button>
        </form>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="tag-list" style={{ marginBottom: 0 }}>
          <button type="button" className={statusFilter === 'pending' ? '' : 'secondary'} onClick={() => setStatusFilter('pending')}>{t('status_pending')}</button>
          <button type="button" className={statusFilter === 'approved' ? '' : 'secondary'} onClick={() => setStatusFilter('approved')}>{t('status_approved')}</button>
          <button type="button" className={statusFilter === 'rejected' ? '' : 'secondary'} onClick={() => setStatusFilter('rejected')}>{t('status_rejected')}</button>
          <button type="button" className={statusFilter === '' ? '' : 'secondary'} onClick={() => setStatusFilter('')}>{t('all_categories')}</button>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>{t('request_type')}</th>
              <th>{t('requested_by')}</th>
              <th>{t('target_staff')}</th>
              <th>{t('department')}</th>
              <th>{t('details')}</th>
              <th>{t('status')}</th>
              {isAdmin && <th>{t('actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>{t(`request_type_${r.request_type}`)}</td>
                <td>{r.requester?.full_name}</td>
                <td>{r.targetUser?.full_name || (r.request_type === 'add' ? r.payload?.full_name : '-')}</td>
                <td>{r.Department?.name_ar || '-'}</td>
                <td className="muted" style={{ fontSize: 12 }}>
                  {r.request_type === 'add' && `${r.payload?.role || ''} — ${r.payload?.username || ''}`}
                  {r.request_type === 'edit' && Object.entries(r.payload || {}).filter(([, v]) => v).map(([k, v]) => `${t(k)}: ${v}`).join(' · ')}
                  {r.request_type === 'transfer' && `${t('new_department')}: ${departments.find((d) => d.id === r.payload?.new_department_id)?.name_ar || '-'}`}
                  {r.request_type === 'delete' && t('deactivation_request')}
                  {r.review_note && <div style={{ marginTop: 4 }}>📝 {r.review_note}</div>}
                </td>
                <td><span className={`badge ${statusBadgeClass[r.status]}`}>{t(`status_${r.status}`)}</span></td>
                {isAdmin && (
                  <td>
                    {r.status === 'pending' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {approvingId === r.id ? (
                          <>
                            {r.request_type === 'add' && (
                              <input type="password" placeholder={t('temp_password')} value={approvePassword} onChange={(e) => setApprovePassword(e.target.value)} style={{ marginBottom: 4 }} />
                            )}
                            <input type="number" placeholder={t('base_salary_optional')} value={approveSalary} onChange={(e) => setApproveSalary(e.target.value)} style={{ marginBottom: 4 }} />
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button type="button" onClick={() => approve(r)}>{t('confirm')}</button>
                              <button type="button" className="secondary" onClick={() => setApprovingId(null)}>{t('cancel')}</button>
                            </div>
                          </>
                        ) : rejectingId === r.id ? (
                          <>
                            <input placeholder={t('review_note_optional')} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} style={{ marginBottom: 4 }} />
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button type="button" onClick={() => reject(r)}>{t('confirm')}</button>
                              <button type="button" className="secondary" onClick={() => setRejectingId(null)}>{t('cancel')}</button>
                            </div>
                          </>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button type="button" onClick={() => { setApprovingId(r.id); setRejectingId(null); }}>✓ {t('approve')}</button>
                            <button type="button" className="secondary" onClick={() => { setRejectingId(r.id); setApprovingId(null); }}>✗ {t('reject')}</button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={isAdmin ? 7 : 6} className="muted">{t('no_data')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

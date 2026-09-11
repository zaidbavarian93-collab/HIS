import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import StaffForm from '../components/StaffForm';

export default function Doctors() {
  const { t } = useTranslation();
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [assignForm, setAssignForm] = useState({}); // { [doctorId]: { department_id, category_id } }
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);

  async function loadAll() {
    const [usersRes, deptRes] = await Promise.all([
      api.get('/users'),
      api.get('/departments'),
    ]);
    setDoctors(usersRes.data.filter((u) => u.role === 'doctor'));
    setDepartments(deptRes.data);
  }

  useEffect(() => { loadAll(); }, []);

  function linksForDoctor(doctorId) {
    const links = [];
    departments.forEach((dept) => {
      (dept.DoctorDepartments || [])
        .filter((l) => l.doctor_id === doctorId)
        .forEach((l) => links.push({ ...l, departmentName: dept.name_ar }));
    });
    return links;
  }

  async function assignDoctor(doctorId) {
    const draft = assignForm[doctorId];
    if (!draft?.department_id) return;
    await api.post(`/departments/${draft.department_id}/doctors`, {
      doctor_id: doctorId,
      category_id: draft.category_id || null,
    });
    setAssignForm({ ...assignForm, [doctorId]: { department_id: '', category_id: '' } });
    loadAll();
  }

  async function removeLink(linkId) {
    await api.delete(`/departments/doctor-links/${linkId}`);
    loadAll();
  }

  function handleSaved() {
    setShowAddForm(false);
    setEditingDoctor(null);
    loadAll();
  }

  return (
    <div>
      <div className="topbar">
        <h2>{t('doctors')}</h2>
        <button onClick={() => { setEditingDoctor(null); setShowAddForm(!showAddForm); }}>
          + {t('add_doctor')}
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">{t('total_doctors')}</div>
          <div className="stat-value">{doctors.length}</div>
        </div>
      </div>

      {showAddForm && !editingDoctor && (
        <StaffForm roleOptions={['doctor']} onSaved={handleSaved} onCancel={() => setShowAddForm(false)} />
      )}
      {editingDoctor && (
        <StaffForm roleOptions={['doctor']} existingUser={editingDoctor} onSaved={handleSaved} onCancel={() => setEditingDoctor(null)} />
      )}

      {doctors.map((doc) => {
        const links = linksForDoctor(doc.id);
        const draft = assignForm[doc.id] || { department_id: '', category_id: '' };
        const selectedDept = departments.find((d) => d.id === draft.department_id);
        const cats = selectedDept?.categories || [];

        return (
          <div className="dept-card" key={doc.id}>
            <div className="dept-card-header">
              <h3>
                {doc.full_name}
                {doc.job_grade && <span className="muted"> — {doc.job_grade}</span>}
              </h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`badge ${doc.is_active ? 'active' : 'inactive'}`}>
                  {doc.is_active ? t('active_status') : t('inactive_status')}
                </span>
                <button className="secondary" onClick={() => { setShowAddForm(false); setEditingDoctor(doc); }}>{t('edit')}</button>
              </div>
            </div>
            {(doc.phone || doc.email || doc.qualification) && (
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
                {doc.phone && <span>{t('phone')}: {doc.phone} · </span>}
                {doc.email && <span>{t('email')}: {doc.email} · </span>}
                {doc.qualification && <span>{t('qualification')}: {doc.qualification}</span>}
              </div>
            )}

            <div className="section-title">{t('assigned_departments')}</div>
            <div className="tag-list" style={{ marginBottom: 12 }}>
              {links.length === 0 && <span className="muted">{t('no_data')}</span>}
              {links.map((l) => (
                <span className="tag" key={l.id}>
                  {l.departmentName}{l.category ? ` — ${l.category.name_ar}` : ''}
                  <button type="button" className="remove-tag" onClick={() => removeLink(l.id)}>×</button>
                </span>
              ))}
            </div>

            <div className="grid-3">
              <div>
                <select
                  value={draft.department_id}
                  onChange={(e) => setAssignForm({ ...assignForm, [doc.id]: { department_id: e.target.value, category_id: '' } })}
                >
                  <option value="">{t('department')}</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name_ar}</option>)}
                </select>
              </div>
              <div>
                <select
                  value={draft.category_id}
                  onChange={(e) => setAssignForm({ ...assignForm, [doc.id]: { ...draft, category_id: e.target.value } })}
                  disabled={!draft.department_id}
                >
                  <option value="">{t('no_category')}</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
                </select>
              </div>
              <div>
                <button type="button" onClick={() => assignDoctor(doc.id)} disabled={!draft.department_id}>
                  + {t('assign_department')}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {doctors.length === 0 && (
        <div className="card muted">{t('no_doctors_yet')}</div>
      )}
    </div>
  );
}

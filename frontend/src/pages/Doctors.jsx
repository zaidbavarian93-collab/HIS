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
  const [expandedId, setExpandedId] = useState(null);
  const [photoFiles, setPhotoFiles] = useState({}); // { [doctorId]: File }
  const [uploadingPhotoId, setUploadingPhotoId] = useState(null);
  const [photoError, setPhotoError] = useState('');

  async function loadAll() {
    const [usersRes, deptRes] = await Promise.all([
      api.get('/users'),
      api.get('/departments'),
    ]);
    setDoctors(usersRes.data.filter((u) => u.role === 'doctor'));
    setDepartments(deptRes.data);
  }

  useEffect(() => { loadAll(); }, []);

  function toggleExpand(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

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

  async function uploadPhoto(doctorId) {
    const file = photoFiles[doctorId];
    if (!file) return;
    setPhotoError('');
    setUploadingPhotoId(doctorId);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      await api.post(`/users/${doctorId}/photo`, fd);
      setPhotoFiles({ ...photoFiles, [doctorId]: null });
      loadAll();
    } catch (err) {
      setPhotoError(err.response?.data?.message || t('save_failed'));
    }
    setUploadingPhotoId(null);
  }

  async function removePhoto(doctorId) {
    await api.delete(`/users/${doctorId}/photo`);
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

      {showAddForm && !editingDoctor && (
        <StaffForm roleOptions={['doctor']} onSaved={handleSaved} onCancel={() => setShowAddForm(false)} />
      )}
      {editingDoctor && (
        <StaffForm roleOptions={['doctor']} existingUser={editingDoctor} onSaved={handleSaved} onCancel={() => setEditingDoctor(null)} />
      )}

      <div className="dept-grid">
        {doctors.map((doc) => {
          const links = linksForDoctor(doc.id);
          const draft = assignForm[doc.id] || { department_id: '', category_id: '' };
          const selectedDept = departments.find((d) => d.id === draft.department_id);
          const cats = selectedDept?.categories || [];
          const isExpanded = expandedId === doc.id;

          return (
            <div className="dept-tile" key={doc.id}>
              <div className="dept-tile-top">
                <span className={`dept-tile-type-badge`} style={{ background: doc.is_active ? undefined : 'var(--border)' }}>
                  {doc.is_active ? t('active_status') : t('inactive_status')}
                </span>
                <div className="dept-tile-icon round">
                  {doc.photo_file ? (
                    <img src={`/api/uploads/staff-photos/${doc.photo_file}`} alt={doc.full_name} />
                  ) : (
                    '🩺'
                  )}
                </div>
                <h3 className="dept-tile-name">{doc.full_name}</h3>
                <div className="dept-tile-name-en">{doc.job_grade || t('doctors')}</div>

                <div className="dept-tile-stats">
                  <div className="dept-tile-stat dept-tile-stat-wide">
                    <div className="dept-tile-stat-label">{t('assigned_departments')}</div>
                    <div className="dept-tile-stat-value" style={{ fontSize: 13 }}>{links.length}</div>
                  </div>
                </div>
              </div>

              <div className="dept-tile-categories">
                <div className="tag-list">
                  {links.length === 0 && <span className="muted">{t('no_data')}</span>}
                  {links.slice(0, 3).map((l) => (
                    <span className="tag" key={l.id}>{l.departmentName}</span>
                  ))}
                  {links.length > 3 && <span className="tag">+{links.length - 3}</span>}
                </div>
              </div>

              <div className="dept-tile-footer">
                <button type="button" className="secondary" onClick={() => toggleExpand(doc.id)}>
                  {isExpanded ? `▴ ${t('close')}` : `⚙️ ${t('manage_department')}`}
                </button>
              </div>

              {isExpanded && (
                <div className="dept-tile-expand">
                  <div className="section-title" style={{ marginBottom: 6 }}>{t('personal_photo')}</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                    <div className="dept-logo-preview round">
                      {doc.photo_file ? (
                        <img src={`/api/uploads/staff-photos/${doc.photo_file}`} alt={doc.full_name} />
                      ) : (
                        '🩺'
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => setPhotoFiles({ ...photoFiles, [doc.id]: e.target.files[0] })}
                        style={{ marginBottom: 6 }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="secondary"
                          disabled={!photoFiles[doc.id] || uploadingPhotoId === doc.id}
                          onClick={() => uploadPhoto(doc.id)}
                        >
                          {uploadingPhotoId === doc.id ? t('uploading') : `⬆️ ${t('upload_photo')}`}
                        </button>
                        {doc.photo_file && (
                          <button type="button" className="secondary" onClick={() => removePhoto(doc.id)}>
                            {t('remove_photo')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {photoError && <div className="error-text">{photoError}</div>}

                  {(doc.phone || doc.email || doc.qualification) && (
                    <div className="muted" style={{ fontSize: 12.5, marginBottom: 14 }}>
                      {doc.phone && <span>{t('phone')}: {doc.phone} · </span>}
                      {doc.email && <span>{t('email')}: {doc.email} · </span>}
                      {doc.qualification && <span>{t('qualification')}: {doc.qualification}</span>}
                    </div>
                  )}

                  <div className="section-title" style={{ marginBottom: 6 }}>{t('assigned_departments')}</div>
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

                  <div style={{ marginTop: 14 }}>
                    <button type="button" className="secondary" onClick={() => { setShowAddForm(false); setEditingDoctor(doc); }}>
                      ✏️ {t('edit')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {doctors.length === 0 && (
        <div className="card muted">{t('no_doctors_yet')}</div>
      )}
    </div>
  );
}

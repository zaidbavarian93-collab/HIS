import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatNumber } from '../utils/format';
import { exportStyledExcel } from '../utils/exportUtils';

const TYPE_ICON = { outpatient: '🏥', inpatient: '🛏️', service: '🧰' };

export default function Departments() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canEditFee = ['admin', 'billing'].includes(user?.role);

  const [departments, setDepartments] = useState([]);
  const [newCategory, setNewCategory] = useState({}); // { [departmentId]: name_ar/name_en }
  const [editingFeeId, setEditingFeeId] = useState(null);
  const [feeDraft, setFeeDraft] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDept, setNewDept] = useState({ name_ar: '', name_en: '', type: 'outpatient', consultation_fee: 0 });
  const [expandedId, setExpandedId] = useState(null);
  const [logoFiles, setLogoFiles] = useState({}); // { [departmentId]: File }
  const [uploadingLogoId, setUploadingLogoId] = useState(null);
  const [logoError, setLogoError] = useState('');

  async function loadAll() {
    const deptRes = await api.get('/departments');
    setDepartments(deptRes.data);
  }

  useEffect(() => { loadAll(); }, []);

  function toggleExpand(id) {
    setExpandedId((prev) => (prev === id ? null : id));
    setEditingFeeId(null);
  }

  function startEditFee(dept) {
    setEditingFeeId(dept.id);
    setFeeDraft(String(dept.consultation_fee ?? 0));
  }

  async function saveFee(deptId) {
    await api.put(`/departments/${deptId}/fee`, { consultation_fee: Number(feeDraft) });
    setEditingFeeId(null);
    loadAll();
  }

  async function addCategory(deptId) {
    const draft = newCategory[deptId];
    if (!draft?.name_ar || !draft?.name_en) return;
    await api.post(`/departments/${deptId}/categories`, draft);
    setNewCategory({ ...newCategory, [deptId]: { name_ar: '', name_en: '' } });
    loadAll();
  }

  async function removeCategory(categoryId) {
    await api.delete(`/departments/categories/${categoryId}`);
    loadAll();
  }

  async function uploadLogo(deptId) {
    const file = logoFiles[deptId];
    if (!file) return;
    setLogoError('');
    setUploadingLogoId(deptId);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      await api.post(`/departments/${deptId}/logo`, fd);
      setLogoFiles({ ...logoFiles, [deptId]: null });
      loadAll();
    } catch (err) {
      setLogoError(err.response?.data?.message || t('save_failed'));
    }
    setUploadingLogoId(null);
  }

  function exportDepartmentsExcel() {
    const rows = departments.map((dept) => ({
      [t('account_name')]: dept.name_ar,
      [t('department_type')]: t(dept.type),
      [t('consultation_fee')]: Number(dept.consultation_fee) || 0,
      [t('assigned_doctors')]: new Set((dept.DoctorDepartments || []).map((l) => l.doctor_id)).size,
      [t('visitors_count')]: dept.visits_count || 0,
      [t('categories')]: (dept.categories || []).map((c) => c.name_ar).join(' - '),
    }));
    exportStyledExcel({
      filename: 'الأقسام',
      sheetName: t('departments'),
      reportTitle: t('departments'),
      columns: [
        { key: t('account_name'), header: t('account_name') },
        { key: t('department_type'), header: t('department_type') },
        { key: t('consultation_fee'), header: t('consultation_fee'), numFmt: '#,##0.00' },
        { key: t('assigned_doctors'), header: t('assigned_doctors') },
        { key: t('visitors_count'), header: t('visitors_count') },
        { key: t('categories'), header: t('categories') },
      ],
      rows,
    });
  }

  async function removeLogo(deptId) {
    await api.delete(`/departments/${deptId}/logo`);
    loadAll();
  }

  async function addDepartment(e) {
    e.preventDefault();
    await api.post('/departments', newDept);
    setNewDept({ name_ar: '', name_en: '', type: 'outpatient', consultation_fee: 0 });
    setShowAddForm(false);
    loadAll();
  }

  return (
    <div>
      <div className="topbar">
        <h2>{t('departments')}</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="secondary" onClick={exportDepartmentsExcel} disabled={departments.length === 0}>📊 {t('export_excel')}</button>
          {isAdmin && <button onClick={() => setShowAddForm(!showAddForm)}>+ {t('add_department')}</button>}
        </div>
      </div>

      {showAddForm && isAdmin && (
        <form className="card" onSubmit={addDepartment}>
          <div className="grid-3">
            <div>
              <label>{t('category_name_ar')}</label>
              <input required value={newDept.name_ar} onChange={(e) => setNewDept({ ...newDept, name_ar: e.target.value })} />
            </div>
            <div>
              <label>{t('category_name_en')}</label>
              <input required value={newDept.name_en} onChange={(e) => setNewDept({ ...newDept, name_en: e.target.value })} />
            </div>
            <div>
              <label>{t('department_type')}</label>
              <select value={newDept.type} onChange={(e) => setNewDept({ ...newDept, type: e.target.value })}>
                <option value="outpatient">{t('outpatient')}</option>
                <option value="inpatient">{t('inpatient')}</option>
                <option value="service">{t('service')}</option>
              </select>
            </div>
            <div>
              <label>{t('consultation_fee')}</label>
              <input type="number" min="0" step="0.01" value={newDept.consultation_fee} onChange={(e) => setNewDept({ ...newDept, consultation_fee: Number(e.target.value) })} />
            </div>
          </div>
          <button type="submit">{t('save')}</button>
        </form>
      )}

      <div className="dept-grid">
        {departments.map((dept) => {
          const cats = dept.categories || [];
          const draftCat = newCategory[dept.id] || { name_ar: '', name_en: '' };
          const doctorCount = new Set((dept.DoctorDepartments || []).map((l) => l.doctor_id)).size;
          const isExpanded = expandedId === dept.id;

          return (
            <div className="dept-tile" key={dept.id}>
              <div className="dept-tile-top">
                <span className="dept-tile-type-badge">{t(dept.type)}</span>
                <div className="dept-tile-icon">
                  {dept.logo_file ? (
                    <img src={`/api/uploads/department-logos/${dept.logo_file}`} alt={dept.name_ar} />
                  ) : (
                    TYPE_ICON[dept.type] || '🏥'
                  )}
                </div>
                <h3 className="dept-tile-name">{dept.name_ar}</h3>
                <div className="dept-tile-name-en">{dept.name_en}</div>

                <div className="dept-tile-stats">
                  <div className="dept-tile-stat">
                    <div className="dept-tile-stat-label">{t('consultation_fee')}</div>
                    <div className="dept-tile-stat-value">{formatNumber(dept.consultation_fee)}</div>
                  </div>
                  <div className="dept-tile-stat">
                    <div className="dept-tile-stat-label">{t('assigned_doctors')}</div>
                    <div className="dept-tile-stat-value">{doctorCount}</div>
                  </div>
                  <div className="dept-tile-stat dept-tile-stat-wide">
                    <div className="dept-tile-stat-label">{t('visitors_count')}</div>
                    <div className="dept-tile-stat-value">{formatNumber(dept.visits_count || 0)}</div>
                  </div>
                </div>
              </div>

              <div className="dept-tile-categories">
                <div className="tag-list">
                  {cats.length === 0 && <span className="muted">{t('no_data')}</span>}
                  {cats.slice(0, 4).map((c) => (
                    <span className="tag" key={c.id}>{c.name_ar}</span>
                  ))}
                  {cats.length > 4 && <span className="tag">+{cats.length - 4}</span>}
                </div>
              </div>

              <div className="dept-tile-footer">
                <button type="button" className="secondary" onClick={() => toggleExpand(dept.id)}>
                  {isExpanded ? `▴ ${t('close')}` : `⚙️ ${t('manage_department')}`}
                </button>
              </div>

              {isExpanded && (
                <div className="dept-tile-expand">
                  {isAdmin && (
                    <>
                      <div className="section-title" style={{ marginBottom: 6 }}>{t('department_logo')}</div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                        <div className="dept-logo-preview">
                          {dept.logo_file ? (
                            <img src={`/api/uploads/department-logos/${dept.logo_file}`} alt={dept.name_ar} />
                          ) : (
                            TYPE_ICON[dept.type] || '🏥'
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            onChange={(e) => setLogoFiles({ ...logoFiles, [dept.id]: e.target.files[0] })}
                            style={{ marginBottom: 6 }}
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="secondary"
                              disabled={!logoFiles[dept.id] || uploadingLogoId === dept.id}
                              onClick={() => uploadLogo(dept.id)}
                            >
                              {uploadingLogoId === dept.id ? t('uploading') : `⬆️ ${t('upload_logo')}`}
                            </button>
                            {dept.logo_file && (
                              <button type="button" className="secondary" onClick={() => removeLogo(dept.id)}>
                                {t('remove_logo')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {logoError && <div className="error-text">{logoError}</div>}
                    </>
                  )}

                  <div className="section-title" style={{ marginBottom: 6 }}>{t('consultation_fee')}</div>
                  {canEditFee && editingFeeId === dept.id ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14 }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={feeDraft}
                        onChange={(e) => setFeeDraft(e.target.value)}
                        style={{ width: 110, marginBottom: 0 }}
                      />
                      <button onClick={() => saveFee(dept.id)}>{t('save')}</button>
                      <button className="secondary" onClick={() => setEditingFeeId(null)}>{t('cancel')}</button>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 14 }}>
                      <span
                        onClick={() => canEditFee && startEditFee(dept)}
                        style={canEditFee ? { cursor: 'pointer', borderBottom: '1px dashed var(--primary)' } : undefined}
                        title={canEditFee ? t('edit_price') : undefined}
                      >
                        {formatNumber(dept.consultation_fee)}
                      </span>
                    </div>
                  )}

                  <div className="section-title" style={{ marginBottom: 6 }}>{t('categories')}</div>
                  <div className="tag-list" style={{ marginBottom: 12 }}>
                    {cats.length === 0 && <span className="muted">{t('no_data')}</span>}
                    {cats.map((c) => (
                      <span className="tag" key={c.id}>
                        {c.name_ar}
                        {isAdmin && <button type="button" className="remove-tag" onClick={() => removeCategory(c.id)}>×</button>}
                      </span>
                    ))}
                  </div>

                  {isAdmin && (
                    <div className="grid-3">
                      <div>
                        <input
                          placeholder={t('category_name_ar')}
                          value={draftCat.name_ar}
                          onChange={(e) => setNewCategory({ ...newCategory, [dept.id]: { ...draftCat, name_ar: e.target.value } })}
                        />
                      </div>
                      <div>
                        <input
                          placeholder={t('category_name_en')}
                          value={draftCat.name_en}
                          onChange={(e) => setNewCategory({ ...newCategory, [dept.id]: { ...draftCat, name_en: e.target.value } })}
                        />
                      </div>
                      <div>
                        <button type="button" className="secondary" onClick={() => addCategory(dept.id)}>+ {t('add_category')}</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

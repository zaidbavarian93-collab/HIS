import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';

// كل الأدوار الوظيفية المتاحة، مقسّمة إلى 4 فئات مستقلة وواضحة:
// 1) الأطباء فقط  2) أطباء الأسنان والصيادلة  3) التقنيون الطبيون والصحيون  4) الإداريون العامون
const ROLE_GROUPS = [
  { label_key: 'role_group_doctors', roles: ['doctor'] },
  { label_key: 'role_group_dental_pharmacy', roles: ['dentist', 'pharmacy'] },
  { label_key: 'role_group_technicians', roles: ['nurse', 'anesthesia_tech', 'radiology_tech', 'lab'] },
  { label_key: 'role_group_admin_general', roles: ['admin', 'management', 'administrative', 'reception', 'billing', 'worker'] },
];

const GRADE_SUGGESTIONS = [
  'استشاري', 'أخصائي أول', 'أخصائي', 'ممارس عام', 'مقيم',
  'ممرض أول', 'ممرض', 'مساعد تمريض',
  'فني أول', 'فني',
  'رئيس قسم', 'موظف',
];

const emptyForm = {
  full_name: '', username: '', password: '', role: 'doctor', department_id: '',
  base_salary: 0, job_grade: '', date_of_birth: '', gender: '', phone: '', email: '',
  qualification: '', marital_status: '', external_affiliation: '', notes: '',
};

// نموذج تسجيل موظف شامل - يُستخدم من صفحات الفئات الأربع (الأطباء/أسنان وصيادلة/تقنيون/إداريون) وصفحة المستخدمين العامة
// roleOptions: قائمة أدوار مسموحة لهذا النموذج فقط (صفحة فئة محددة) - عند تركها فارغة تظهر كل الفئات مجمّعة
export default function StaffForm({ roleOptions, lockedRole, onSaved, onCancel, existingUser }) {
  const { t } = useTranslation();
  const effectiveRoleOptions = roleOptions || (lockedRole ? [lockedRole] : null);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(() => (
    existingUser
      ? {
          full_name: existingUser.full_name || '', username: existingUser.username || '', password: '',
          role: existingUser.role || effectiveRoleOptions?.[0] || 'doctor', department_id: existingUser.department_id || '',
          base_salary: existingUser.base_salary || 0, job_grade: existingUser.job_grade || '',
          date_of_birth: existingUser.date_of_birth || '', gender: existingUser.gender || '',
          phone: existingUser.phone || '', email: existingUser.email || '',
          qualification: existingUser.qualification || '', marital_status: existingUser.marital_status || '',
          external_affiliation: existingUser.external_affiliation || '', notes: existingUser.notes || '',
        }
      : { ...emptyForm, role: effectiveRoleOptions?.[0] || 'doctor' }
  ));
  const [certificateFile, setCertificateFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/departments').then((res) => setDepartments(res.data)).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      let userId = existingUser?.id;
      if (existingUser) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.put(`/users/${existingUser.id}`, payload);
      } else {
        const { data } = await api.post('/users', form);
        userId = data.id;
      }

      if (certificateFile && userId) {
        const fd = new FormData();
        fd.append('certificate', certificateFile);
        await api.post(`/users/${userId}/certificate`, fd);
      }

      onSaved?.();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || t('save_failed'));
    }
    setSaving(false);
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="section-title">{t('personal_info')}</div>
      <div className="grid-3">
        <div>
          <label>{t('full_name')} *</label>
          <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div>
          <label>{t('date_of_birth')}</label>
          <input type="date" value={form.date_of_birth || ''} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
        </div>
        <div>
          <label>{t('gender')}</label>
          <select value={form.gender || ''} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="">-</option>
            <option value="male">{t('male')}</option>
            <option value="female">{t('female')}</option>
          </select>
        </div>
        <div>
          <label>{t('phone')}</label>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label>{t('email')}</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label>{t('marital_status')}</label>
          <select value={form.marital_status || ''} onChange={(e) => setForm({ ...form, marital_status: e.target.value })}>
            <option value="">-</option>
            <option value="single">{t('single')}</option>
            <option value="married">{t('married')}</option>
            <option value="divorced">{t('divorced')}</option>
            <option value="widowed">{t('widowed')}</option>
          </select>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 16 }}>{t('professional_info')}</div>
      <div className="grid-3">
        <div>
          <label>{t('role_label')} *</label>
          <select
            required
            disabled={effectiveRoleOptions?.length === 1}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {effectiveRoleOptions ? (
              effectiveRoleOptions.map((r) => <option key={r} value={r}>{t(`role_${r}`)}</option>)
            ) : (
              ROLE_GROUPS.map((group) => (
                <optgroup key={group.label_key} label={t(group.label_key)}>
                  {group.roles.map((r) => <option key={r} value={r}>{t(`role_${r}`)}</option>)}
                </optgroup>
              ))
            )}
          </select>
        </div>
        <div>
          <label>{t('job_grade')}</label>
          <input list="grade-suggestions" value={form.job_grade} onChange={(e) => setForm({ ...form, job_grade: e.target.value })} placeholder={t('job_grade_placeholder')} />
          <datalist id="grade-suggestions">
            {GRADE_SUGGESTIONS.map((g) => <option key={g} value={g} />)}
          </datalist>
        </div>
        <div>
          <label>{t('department')}</label>
          <select value={form.department_id || ''} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
            <option value="">-</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name_ar}</option>)}
          </select>
        </div>
        <div>
          <label>{t('qualification')}</label>
          <input value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} placeholder={t('qualification_placeholder')} />
        </div>
        <div>
          <label>{t('base_salary')}</label>
          <input type="number" min="0" step="0.01" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: Number(e.target.value) })} />
        </div>
        <div>
          <label>{t('external_affiliation')}</label>
          <input value={form.external_affiliation} onChange={(e) => setForm({ ...form, external_affiliation: e.target.value })} placeholder={t('external_affiliation_placeholder')} />
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 16 }}>{t('account_info')}</div>
      <div className="grid-3">
        <div>
          <label>{t('username')} *</label>
          <input required disabled={!!existingUser} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </div>
        <div>
          <label>{t('password')} {existingUser ? `(${t('leave_blank_keep')})` : '*'}</label>
          <input required={!existingUser} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div>
          <label>{t('certificate_upload')}</label>
          <input type="file" accept=".pdf,image/*" onChange={(e) => setCertificateFile(e.target.files?.[0] || null)} />
        </div>
      </div>

      <div>
        <label>{t('notes')}</label>
        <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      {error && <div className="error-text">{error}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={saving}>{saving ? t('saving') : t('save')}</button>
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>{t('cancel')}</button>}
      </div>
    </form>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { printHtml, exportToWord, exportToExcel } from '../utils/exportUtils';
import { formatMoney as fmt } from '../utils/format';
import StaffForm from './StaffForm';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function calcAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const diffMs = Date.now() - birth.getTime();
  return Math.floor(diffMs / (365.25 * 24 * 3600 * 1000));
}

// صفحة الكادر البشري الموحّدة - تُستخدم من قسمي "الموارد البشرية" و"الحسابات" معًا
// النسخة المالية (includeFinancials) تضيف عمود الشهر وأعمدة الرواتب/الاستقطاعات لتصدير Excel فقط
export default function StaffRosterPage({ titleKey, includeFinancials, editable }) {
  const { t } = useTranslation();
  const [staff, setStaff] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [payrollByUser, setPayrollByUser] = useState({});
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  async function loadStaff() {
    const { data } = await api.get('/users');
    setStaff(data);
  }

  function handleSaved() {
    setShowForm(false);
    setEditingUser(null);
    loadStaff();
  }

  async function deleteStaff(u) {
    if (!window.confirm(`${t('confirm_delete_staff')} — ${u.full_name}`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      loadStaff();
    } catch (err) {
      window.alert(err.response?.data?.message || t('save_failed'));
    }
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

  async function loadPayroll() {
    if (!includeFinancials) return;
    const { data } = await api.get('/payroll', { params: { month } });
    const map = {};
    data.forEach((p) => { map[p.user_id] = p; });
    setPayrollByUser(map);
  }

  useEffect(() => { loadStaff(); }, []);
  useEffect(() => { loadPayroll(); }, [month, includeFinancials]);

  const filtered = categoryFilter === 'all' ? staff : staff.filter((s) => s.role === categoryFilter);
  const roles = [...new Set(staff.map((s) => s.role))];

  function rowData(u) {
    const p = payrollByUser[u.id];
    return {
      full_name: u.full_name,
      role: t(`role_${u.role}`),
      job_grade: u.job_grade || '-',
      qualification: u.qualification || '-',
      age: calcAge(u.date_of_birth) ?? '-',
      gender: u.gender ? t(u.gender) : '-',
      department: u.Department?.name_ar || '-',
      external_affiliation: u.external_affiliation || '-',
      phone: u.phone || '-',
      email: u.email || '-',
      status: u.is_active ? t('active_status') : t('inactive_status'),
      ...(includeFinancials
        ? {
            base_salary: p ? Number(p.base_salary) : Number(u.base_salary),
            allowances: p ? Number(p.allowances) : 0,
            deductions: p ? Number(p.deductions) : 0,
            social_security_deduction: p ? Number(p.social_security_deduction) : 0,
            income_tax_deduction: p ? Number(p.income_tax_deduction) : 0,
            net_salary: p ? Number(p.net_salary) : 0,
            payroll_status: p ? (p.status === 'paid' ? t('paid') : t('pending')) : '-',
          }
        : {}),
    };
  }

  function doPrint() {
    const headers = [
      t('full_name'), t('role_label'), t('job_grade'), t('qualification'), t('age'), t('gender'),
      t('department_affiliation'), t('phone'),
    ];
    if (includeFinancials) headers.push(t('base_salary'), t('net_salary'));

    const rows = filtered
      .map((u) => {
        const d = rowData(u);
        const cells = [
          d.full_name, d.role, d.job_grade, d.qualification, d.age, d.gender, d.department, d.phone,
        ];
        if (includeFinancials) cells.push(fmt(d.base_salary), fmt(d.net_salary));
        return `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
      })
      .join('');

    const body = `
      <h1>${t(titleKey)}</h1>
      <div class="meta">${t('printed_on')}: ${new Date().toLocaleString('en-GB')} &nbsp;|&nbsp; ${t('total_employees')}: ${filtered.length}</div>
      <table>
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    printHtml(t(titleKey), body);
  }

  function doExportWord() {
    const headers = [
      t('full_name'), t('role_label'), t('job_grade'), t('qualification'), t('age'), t('gender'),
      t('department_affiliation'), t('phone'),
    ];
    const rows = filtered
      .map((u) => {
        const d = rowData(u);
        const cells = [d.full_name, d.role, d.job_grade, d.qualification, d.age, d.gender, d.department, d.phone];
        return `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
      })
      .join('');
    const body = `<h1>${t(titleKey)}</h1><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
    exportToWord(t(titleKey), t(titleKey), body);
  }

  function doExportExcel() {
    const rows = filtered.map((u) => {
      const d = rowData(u);
      const base = {
        [t('full_name')]: d.full_name,
        [t('role_label')]: d.role,
        [t('job_grade')]: d.job_grade,
        [t('qualification')]: d.qualification,
        [t('age')]: d.age,
        [t('gender')]: d.gender,
        [t('department_affiliation')]: d.department,
        [t('external_affiliation')]: d.external_affiliation,
        [t('phone')]: d.phone,
        [t('email')]: d.email,
        [t('status')]: d.status,
      };
      if (includeFinancials) {
        base[t('month')] = month;
        base[t('base_salary')] = d.base_salary;
        base[t('allowances')] = d.allowances;
        base[t('deductions')] = d.deductions;
        base[t('social_security')] = d.social_security_deduction;
        base[t('income_tax')] = d.income_tax_deduction;
        base[t('net_salary')] = d.net_salary;
        base[t('payroll_status')] = d.payroll_status;
      }
      return base;
    });
    exportToExcel(t(titleKey), t(titleKey), rows, { reportTitle: t(titleKey), reportSubtitle: includeFinancials ? `${t('month')}: ${month}` : undefined });
  }

  return (
    <div>
      <div className="topbar">
        <h2>{t(titleKey)}</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {includeFinancials && (
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 160, marginBottom: 0 }} />
          )}
          <button className="secondary" onClick={doPrint}>🖨️ {t('print')}</button>
          <button className="secondary" onClick={doExportWord}>📄 {t('export_word')}</button>
          <button onClick={doExportExcel}>📊 {t('export_excel')}</button>
          {editable && (
            <button onClick={() => { setEditingUser(null); setShowForm(!showForm); }}>
              + {t('add_staff')}
            </button>
          )}
        </div>
      </div>

      {editable && showForm && !editingUser && (
        <StaffForm onSaved={handleSaved} onCancel={() => setShowForm(false)} />
      )}
      {editable && editingUser && (
        <StaffForm existingUser={editingUser} onSaved={handleSaved} onCancel={() => setEditingUser(null)} />
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">{t('total_staff_in_category')}</div>
          <div className="stat-value">{filtered.length}</div>
        </div>
        {includeFinancials && (
          <div className="stat-card">
            <div className="stat-label">{t('total_net_salaries')}</div>
            <div className="stat-value">
              {fmt(filtered.reduce((sum, u) => sum + (rowData(u).net_salary || 0), 0))}
            </div>
          </div>
        )}
      </div>

      <div className="tag-list" style={{ marginBottom: 16 }}>
        <button className={categoryFilter === 'all' ? '' : 'secondary'} onClick={() => setCategoryFilter('all')} type="button">
          {t('all_categories')}
        </button>
        {roles.map((r) => (
          <button key={r} className={categoryFilter === r ? '' : 'secondary'} onClick={() => setCategoryFilter(r)} type="button">
            {t(`role_${r}`)}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>{t('full_name')}</th>
              <th>{t('role_label')}</th>
              <th>{t('job_grade')}</th>
              <th>{t('qualification')}</th>
              <th>{t('age')}</th>
              <th>{t('gender')}</th>
              <th>{t('department_affiliation')}</th>
              <th>{t('phone')}</th>
              {includeFinancials && <th>{t('base_salary')}</th>}
              {includeFinancials && <th>{t('net_salary')}</th>}
              <th>{t('status')}</th>
              {editable && <th>{t('certificate_upload')}</th>}
              {editable && <th></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const d = rowData(u);
              return (
                <tr key={u.id}>
                  <td>{d.full_name}</td>
                  <td>{d.role}</td>
                  <td>{d.job_grade}</td>
                  <td>{d.qualification}</td>
                  <td>{d.age}</td>
                  <td>{d.gender}</td>
                  <td>{d.department}{d.external_affiliation !== '-' ? ` (${d.external_affiliation})` : ''}</td>
                  <td>{d.phone}</td>
                  {includeFinancials && <td>{fmt(d.base_salary)}</td>}
                  {includeFinancials && <td style={{ fontWeight: 700 }}>{fmt(d.net_salary)}</td>}
                  <td><span className={`badge ${u.is_active ? 'active' : 'inactive'}`}>{d.status}</span></td>
                  {editable && (
                    <td>
                      {u.certificate_file ? (
                        <button className="secondary" onClick={() => downloadCertificate(u)}>⬇️ {t('download')}</button>
                      ) : (
                        <span className="muted">{t('no_certificate')}</span>
                      )}
                    </td>
                  )}
                  {editable && (
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="secondary" onClick={() => { setShowForm(false); setEditingUser(u); }}>{t('edit')}</button>
                      <button className="secondary" onClick={() => deleteStaff(u)}>{t('delete')}</button>
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={includeFinancials ? (editable ? 13 : 11) : (editable ? 11 : 9)} className="muted">{t('no_data')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

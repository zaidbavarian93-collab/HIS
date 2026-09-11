import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import DonutChart from '../components/DonutChart';
import { formatMoney } from '../utils/format';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function KpiDashboard() {
  const { t } = useTranslation();
  const [month, setMonth] = useState(currentMonth());
  const [kpis, setKpis] = useState(null);

  async function loadKpis() {
    const { data } = await api.get('/kpis', { params: { month } });
    setKpis(data);
  }

  useEffect(() => { loadKpis(); }, [month]);

  if (!kpis) return <div className="muted">{t('loading')}</div>;

  const statusLabels = {
    booked: t('booked'), checked_in: t('checked_in'), in_progress: t('in_progress'),
    completed: t('completed'), cancelled: t('cancelled'), no_show: t('no_show'),
  };
  const categoryLabels = { medicine: t('medicine'), medical_supply: t('medical_supply'), equipment: t('equipment') };
  const attendanceLabels = { present: t('present'), late: t('late'), absent: t('absent'), leave: t('leave') };
  const roleLabels = {
    admin: 'Admin', management: 'Management', reception: 'Reception', doctor: t('doctors'),
    nurse: 'Nurse', pharmacy: 'Pharmacy', lab: 'Lab', billing: 'Billing',
  };
  const insuranceTypeLabels = {
    citizen: t('member_type_citizen'), staff: t('member_type_staff'), dependent: t('member_type_dependent'),
  };
  const insuranceStatusLabels = { active: t('active'), suspended: t('suspended'), expired: t('expired') };

  return (
    <div>
      <div className="topbar">
        <h2>{t('kpi_dashboard')}</h2>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 160, marginBottom: 0 }} />
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">{t('total_patients')}</div>
          <div className="stat-value">{kpis.patients.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('new_patients_month')}</div>
          <div className="stat-value">{kpis.patients.new_this_month}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('appointments_today')}</div>
          <div className="stat-value">{kpis.appointments.today}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('appointments_month')}</div>
          <div className="stat-value">{kpis.appointments.this_month}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('revenue_this_month')}</div>
          <div className="stat-value">{formatMoney(kpis.revenue.paid_this_month)}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-label">{t('unpaid_total')}</div>
          <div className="stat-value">{formatMoney(kpis.revenue.unpaid_total)}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-label">{t('low_stock_alert')}</div>
          <div className="stat-value">{kpis.inventory.low_stock}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('total_inventory_value')}</div>
          <div className="stat-value">{formatMoney(kpis.inventory.total_value)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('payroll_net_month')}</div>
          <div className="stat-value">{formatMoney(kpis.payroll.total_net)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('active_staff')}</div>
          <div className="stat-value">{kpis.staff.active_total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">🛡️ {t('active_insured_members')}</div>
          <div className="stat-value">{kpis.insurance.active_members}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">🛡️ {t('insurance_covered_month')}</div>
          <div className="stat-value">{formatMoney(kpis.insurance.covered_this_month)}</div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 16 }}>
        <div className="card">
          <div className="section-title">{t('appointments_by_status')}</div>
          <DonutChart data={kpis.appointments.by_status} labels={statusLabels} />
        </div>
        <div className="card">
          <div className="section-title">{t('attendance_today_breakdown')}</div>
          <DonutChart data={kpis.attendance_today} labels={attendanceLabels} />
        </div>
        <div className="card">
          <div className="section-title">{t('inventory_by_category')}</div>
          <DonutChart data={kpis.inventory.by_category} labels={categoryLabels} />
        </div>
        <div className="card">
          <div className="section-title">{t('staff_by_role')}</div>
          <DonutChart data={kpis.staff.by_role} labels={roleLabels} />
        </div>
        <div className="card">
          <div className="section-title">🛡️ {t('insurance_by_type')}</div>
          <DonutChart data={kpis.insurance.by_type} labels={insuranceTypeLabels} />
        </div>
        <div className="card">
          <div className="section-title">🛡️ {t('insurance_by_status')}</div>
          <DonutChart data={kpis.insurance.by_status} labels={insuranceStatusLabels} />
        </div>
      </div>

      <div className="card">
        <div className="section-title">{t('payroll_summary')}</div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div className="muted">{t('paid_count')}</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{kpis.payroll.paid_count}</div>
          </div>
          <div>
            <div className="muted">{t('pending_count')}</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{kpis.payroll.pending_count}</div>
          </div>
          <div>
            <div className="muted">{t('unpaid_invoices_count')}</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{kpis.revenue.unpaid_count}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

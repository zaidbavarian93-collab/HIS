import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import AttendanceWidget from '../components/AttendanceWidget';
import DonutChart from '../components/DonutChart';
import { formatMoney } from '../utils/format';

const KPI_PREVIEW_ROLES = ['admin', 'management', 'billing'];

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [kpis, setKpis] = useState(null);
  const canSeeKpis = KPI_PREVIEW_ROLES.includes(user?.role);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    api.get(`/appointments?date=${today}`).then((res) => setTodayAppointments(res.data)).catch(() => {});
    api.get('/invoices?status=unpaid').then((res) => setUnpaidInvoices(res.data)).catch(() => {});
    api.get('/inventory').then((res) => {
      setLowStockCount(res.data.filter((i) => i.quantity <= i.min_stock).length);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!canSeeKpis) return;
    const month = new Date().toISOString().slice(0, 7);
    api.get('/kpis', { params: { month } }).then((res) => setKpis(res.data)).catch(() => {});
  }, [canSeeKpis]);

  return (
    <div>
      <div className="topbar">
        <h2>{t('welcome')}, {user?.full_name}</h2>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">{t('appointments')} - {new Date().toLocaleDateString('en-GB')}</div>
          <div className="stat-value">{todayAppointments.length}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-label">{t('unpaid')} {t('billing')}</div>
          <div className="stat-value">{unpaidInvoices.length}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-label">{t('low_stock_alert')}</div>
          <div className="stat-value">{lowStockCount}</div>
        </div>
      </div>
      <div className="grid-2" style={{ gap: 16 }}>
        <div className="card">
          <div className="section-title">{t('appointments_by_status')}</div>
          <DonutChart
            data={todayAppointments.reduce((acc, a) => {
              acc[a.status] = (acc[a.status] || 0) + 1;
              return acc;
            }, {})}
            labels={{
              booked: t('booked'), checked_in: t('checked_in'), in_progress: t('in_progress'),
              completed: t('completed'), cancelled: t('cancelled'), no_show: t('no_show'),
            }}
          />
        </div>
        <AttendanceWidget />
      </div>

      {canSeeKpis && kpis && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="topbar" style={{ marginBottom: 10 }}>
            <div className="section-title" style={{ margin: 0 }}>{t('kpi_dashboard')}</div>
            <Link to="/kpis" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>{t('view_details')} ←</Link>
          </div>
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <div className="stat-card">
              <div className="stat-label">{t('revenue_this_month')}</div>
              <div className="stat-value">{formatMoney(kpis.revenue.paid_this_month)}</div>
            </div>
            <div className="stat-card warn">
              <div className="stat-label">{t('unpaid_total')}</div>
              <div className="stat-value">{formatMoney(kpis.revenue.unpaid_total)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{t('new_patients_month')}</div>
              <div className="stat-value">{kpis.patients.new_this_month}</div>
            </div>
          </div>
          <DonutChart
            data={kpis.appointments.by_status}
            labels={{
              booked: t('booked'), checked_in: t('checked_in'), in_progress: t('in_progress'),
              completed: t('completed'), cancelled: t('cancelled'), no_show: t('no_show'),
            }}
          />
        </div>
      )}
    </div>
  );
}

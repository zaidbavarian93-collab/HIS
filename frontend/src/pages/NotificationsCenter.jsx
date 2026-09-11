import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';

const TYPE_ICON = { appointment_reminder: '📅', insurance_renewal: '🛡️' };
const STATUS_BADGE = { pending: 'low-stock', sent: 'active', failed: 'inactive' };

export default function NotificationsCenter() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [realGateway, setRealGateway] = useState(false);
  const [filters, setFilters] = useState({ notification_type: '', status: '', channel: '' });
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadNotifications() {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications', { params: filters });
      setNotifications(data.notifications);
      setRealGateway(data.real_gateway_configured);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadNotifications(); }, [filters]);

  async function runCycle() {
    setRunning(true);
    setRunResult(null);
    try {
      const { data } = await api.post('/notifications/run-cycle');
      setRunResult(data);
      loadNotifications();
    } finally {
      setRunning(false);
    }
  }

  const pendingCount = notifications.filter((n) => n.status === 'pending').length;
  const sentCount = notifications.filter((n) => n.status === 'sent').length;
  const reminderCount = notifications.filter((n) => n.notification_type === 'appointment_reminder').length;
  const renewalCount = notifications.filter((n) => n.notification_type === 'insurance_renewal').length;

  return (
    <div>
      <div className="topbar">
        <h2>🔔 {t('notifications_center')}</h2>
        <button onClick={runCycle} disabled={running}>{running ? t('loading') : `⚡ ${t('run_cycle_now')}`}</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">{t('notifications_hint_title')}</div>
        <p style={{ lineHeight: 1.8, fontSize: 13.5 }} className="muted">{t('notifications_hint_body')}</p>
        <div style={{ marginTop: 8 }}>
          <span className={`badge ${realGateway ? 'active' : 'low-stock'}`}>
            {realGateway ? `✅ ${t('real_gateway_active')}` : `⚙️ ${t('simulation_mode')}`}
          </span>
        </div>
        {runResult && (
          <div className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
            {t('run_cycle_result', { appts: runResult.appointmentsCount, renewals: runResult.renewalsCount, sent: runResult.dispatchedCount })}
          </div>
        )}
      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">{t('appointment_reminders')}</div>
          <div className="stat-value">{reminderCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('insurance_renewals')}</div>
          <div className="stat-value">{renewalCount}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-label">{t('status_pending')}</div>
          <div className="stat-value">{pendingCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('status_sent')}</div>
          <div className="stat-value">{sentCount}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="tag-list" style={{ marginBottom: 0 }}>
          <button type="button" className={filters.notification_type === '' ? '' : 'secondary'} onClick={() => setFilters({ ...filters, notification_type: '' })}>{t('all_categories')}</button>
          <button type="button" className={filters.notification_type === 'appointment_reminder' ? '' : 'secondary'} onClick={() => setFilters({ ...filters, notification_type: 'appointment_reminder' })}>📅 {t('appointment_reminders')}</button>
          <button type="button" className={filters.notification_type === 'insurance_renewal' ? '' : 'secondary'} onClick={() => setFilters({ ...filters, notification_type: 'insurance_renewal' })}>🛡️ {t('insurance_renewals')}</button>
        </div>
      </div>

      {loading && <div className="muted">{t('loading')}</div>}

      {!loading && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('notification_type')}</th>
                <th>{t('channel')}</th>
                <th>{t('recipient_name')}</th>
                <th>{t('recipient_contact')}</th>
                <th>{t('message')}</th>
                <th>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id}>
                  <td style={{ fontSize: 12.5 }}>{new Date(n.createdAt).toLocaleString('en-GB')}</td>
                  <td>{TYPE_ICON[n.notification_type]} {t(n.notification_type)}</td>
                  <td>{n.channel === 'sms' ? '📱 SMS' : '✉️ Email'}</td>
                  <td>{n.recipient_name}</td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{n.recipient_phone || n.recipient_email || '-'}</td>
                  <td style={{ fontSize: 12.5, maxWidth: 320 }}>{n.message}</td>
                  <td><span className={`badge ${STATUS_BADGE[n.status]}`}>{t(`status_${n.status}`)}{n.simulated && n.status === 'sent' ? ` (${t('simulated')})` : ''}</span></td>
                </tr>
              ))}
              {notifications.length === 0 && <tr><td colSpan={7} className="muted">{t('no_data')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

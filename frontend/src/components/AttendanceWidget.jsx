import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';

// بطاقة تسجيل الحضور/الانصراف الذاتي - تظهر لكل المستخدمين في لوحة التحكم
export default function AttendanceWidget() {
  const { t } = useTranslation();
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadToday() {
    const { data } = await api.get('/attendance/today');
    setToday(data);
  }

  useEffect(() => { loadToday(); }, []);

  async function checkIn() {
    setLoading(true);
    try {
      await api.post('/attendance/check-in');
      await loadToday();
    } catch (err) {
      // تجاهل صامت - رسالة الخادم كافية عند العرض
    }
    setLoading(false);
  }

  async function checkOut() {
    setLoading(true);
    try {
      await api.post('/attendance/check-out');
      await loadToday();
    } catch (err) {
      // تجاهل صامت
    }
    setLoading(false);
  }

  function fmtTime(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="card">
      <div className="section-title">🕒 {t('attendance')}</div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <div className="muted">{t('check_in')}</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{fmtTime(today?.check_in)}</div>
        </div>
        <div>
          <div className="muted">{t('check_out')}</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{fmtTime(today?.check_out)}</div>
        </div>
        {today?.status && (
          <span className={`badge ${today.status === 'late' ? 'low-stock' : today.status === 'absent' ? 'out-of-stock' : 'active'}`}>
            {t(today.status)}
          </span>
        )}
        <div style={{ display: 'flex', gap: 8, marginInlineStart: 'auto' }}>
          <button onClick={checkIn} disabled={loading || !!today?.check_in}>{t('check_in')}</button>
          <button className="secondary" onClick={checkOut} disabled={loading || !today?.check_in || !!today?.check_out}>{t('check_out')}</button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// دقائق الانتظار منذ تسجيل الوصول - تُحدَّث تلقائيًا كل دقيقة عبر tick
function waitMinutes(checkedInAt, tick) {
  if (!checkedInAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(checkedInAt).getTime()) / 60000)) + tick * 0;
}

// طابور الانتظار - لوحة حية لكل قسم: "قيد الكشف الآن" + تذاكر منتظرة مرتبة (العاجل أولًا ثم رقم التذكرة)
// التصميم المميز: تذاكر دائرية مرقّمة أشبه بشاشات طوابير العيادات، مع نبض أحمر للحالات العاجلة
export default function Queue() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [deptFilter, setDeptFilter] = useState('all');
  const [board, setBoard] = useState({ nowServing: [], waiting: [] });
  const [bookedToday, setBookedToday] = useState([]);
  const [tick, setTick] = useState(0);
  const canManage = ['admin', 'reception', 'doctor', 'nurse'].includes(user?.role);

  async function loadBoard() {
    const { data } = await api.get('/appointments/queue/board', {
      params: deptFilter !== 'all' ? { department_id: deptFilter } : {},
    });
    setBoard(data);
  }

  async function loadBookedToday() {
    const { data } = await api.get('/appointments', { params: { date: todayStr() } });
    setBookedToday(data.filter((a) => a.status === 'booked'));
  }

  useEffect(() => {
    api.get('/departments').then((res) => setDepartments(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadBoard();
    loadBookedToday();
    const boardTimer = setInterval(loadBoard, 15000);
    const tickTimer = setInterval(() => setTick((v) => v + 1), 60000);
    return () => { clearInterval(boardTimer); clearInterval(tickTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptFilter]);

  async function checkIn(id) {
    await api.put(`/appointments/${id}/status`, { status: 'checked_in' });
    loadBoard();
    loadBookedToday();
  }

  async function callNext(id) {
    await api.put(`/appointments/${id}/status`, { status: 'in_progress' });
    loadBoard();
  }

  async function complete(id) {
    await api.put(`/appointments/${id}/status`, { status: 'completed' });
    loadBoard();
  }

  async function noShow(id) {
    await api.put(`/appointments/${id}/status`, { status: 'no_show' });
    loadBoard();
  }

  async function togglePriority(a) {
    await api.put(`/appointments/${a.id}/priority`, { priority: a.priority === 'urgent' ? 'normal' : 'urgent' });
    loadBoard();
  }

  const deptNameById = useMemo(() => {
    const map = {};
    departments.forEach((d) => { map[d.id] = d.name_ar; });
    return map;
  }, [departments]);

  return (
    <div>
      <div className="topbar">
        <h2>{t('waiting_queue')}</h2>
      </div>

      <div className="tag-list" style={{ marginBottom: 20 }}>
        <button className={deptFilter === 'all' ? '' : 'secondary'} onClick={() => setDeptFilter('all')} type="button">
          {t('all_departments')}
        </button>
        {departments.map((d) => (
          <button key={d.id} className={deptFilter === d.id ? '' : 'secondary'} onClick={() => setDeptFilter(d.id)} type="button">
            {d.name_ar}
          </button>
        ))}
      </div>

      {/* لوحة "قيد الكشف الآن" - أرقام كبيرة متوهجة أشبه بشاشة عرض عيادة فعلية */}
      <div className="queue-now-serving-grid">
        {board.nowServing.length === 0 && (
          <div className="card muted" style={{ textAlign: 'center' }}>{t('no_one_in_progress')}</div>
        )}
        {board.nowServing.map((a) => (
          <div key={a.id} className="queue-now-card">
            <div className="queue-now-label">{t('now_serving')}</div>
            <div className="queue-now-number">{a.queue_number}</div>
            <div className="queue-now-patient">{a.Patient?.full_name}</div>
            <div className="queue-now-meta">{a.doctor?.full_name} — {a.Department?.name_ar || deptNameById[a.department_id]}</div>
            {canManage && (
              <div className="queue-now-actions">
                <button className="secondary" onClick={() => complete(a.id)}>✅ {t('finish_visit')}</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* قائمة التذاكر المنتظرة - العاجل يظهر أولًا بتوهج أحمر نابض */}
      <div className="section-title" style={{ marginTop: 28 }}>🎫 {t('waiting_tickets')} ({board.waiting.length})</div>
      <div className="queue-tickets-row">
        {board.waiting.length === 0 && <div className="muted">{t('no_waiting_tickets')}</div>}
        {board.waiting.map((a) => (
          <div key={a.id} className={`queue-ticket${a.priority === 'urgent' ? ' urgent' : ''}`}>
            <div className="queue-ticket-number">{a.queue_number}</div>
            <div className="queue-ticket-name">{a.Patient?.full_name}</div>
            <div className="queue-ticket-meta">{a.doctor?.full_name}</div>
            <div className="queue-ticket-wait">⏱ {waitMinutes(a.checked_in_at, tick)} {t('minutes_short')}</div>
            {canManage && (
              <div className="queue-ticket-actions">
                <button className="secondary" onClick={() => togglePriority(a)} title={t('toggle_urgent')}>
                  {a.priority === 'urgent' ? '⚡' : '🔼'}
                </button>
                <button onClick={() => callNext(a.id)} title={t('call_patient')}>▶️</button>
                <button className="danger" onClick={() => noShow(a.id)} title={t('no_show')}>✖</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* مواعيد اليوم التي لم تصل بعد - تسجيل الوصول يضيفها لطابور الانتظار برقم تذكرة تلقائي */}
      {canManage && (
        <>
          <div className="section-title" style={{ marginTop: 28 }}>{t('todays_booked_not_arrived')} ({bookedToday.length})</div>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{t('scheduled_at')}</th>
                  <th>{t('patients')}</th>
                  <th>{t('doctor')}</th>
                  <th>{t('department')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bookedToday.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{a.Patient?.full_name}</td>
                    <td>{a.doctor?.full_name}</td>
                    <td>{a.Department?.name_ar}</td>
                    <td><button className="secondary" onClick={() => checkIn(a.id)}>🎫 {t('check_in')}</button></td>
                  </tr>
                ))}
                {bookedToday.length === 0 && (
                  <tr><td colSpan={5} className="muted">{t('no_data')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

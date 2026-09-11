import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Appointments() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ patient_id: '', doctor_id: '', department_id: '', scheduled_at: '' });
  const canBook = ['admin', 'reception'].includes(user?.role);

  async function loadAppointments() {
    const { data } = await api.get('/appointments', { params: { date } });
    setAppointments(data);
  }

  useEffect(() => {
    loadAppointments();
  }, [date]);

  useEffect(() => {
    api.get('/departments').then((res) => setDepartments(res.data));
    api.get('/patients').then((res) => setPatients(res.data));
    api.get('/users/doctors').then((res) => setDoctors(res.data)).catch(() => {});
  }, []);

  async function handleBook(e) {
    e.preventDefault();
    await api.post('/appointments', form);
    setShowForm(false);
    loadAppointments();
  }

  async function updateStatus(id, status) {
    await api.put(`/appointments/${id}/status`, { status });
    loadAppointments();
  }

  return (
    <div>
      <div className="topbar">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 180, marginBottom: 0 }} />
        {canBook && <button onClick={() => setShowForm(!showForm)}>{t('new_appointment')}</button>}
      </div>

      {showForm && (
        <form className="card" onSubmit={handleBook}>
          <div className="grid-2">
            <div>
              <label>{t('patients')}</label>
              <select required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                <option value="">-</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.file_number})</option>)}
              </select>
            </div>
            <div>
              <label>{t('department')}</label>
              <select required value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                <option value="">-</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name_ar}</option>)}
              </select>
            </div>
            <div>
              <label>{t('doctor')}</label>
              <select required value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
                <option value="">-</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
              </select>
            </div>
            <div>
              <label>{t('scheduled_at')}</label>
              <input required type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
            </div>
          </div>
          <button type="submit">{t('save')}</button>
        </form>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('scheduled_at')}</th>
              <th>{t('patients')}</th>
              <th>{t('doctor')}</th>
              <th>{t('department')}</th>
              <th>{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td>{a.Patient?.full_name}</td>
                <td>{a.doctor?.full_name}</td>
                <td>{a.Department?.name_ar}</td>
                <td>
                  <select value={a.status} onChange={(e) => updateStatus(a.id, e.target.value)} style={{ marginBottom: 0, width: 140 }}>
                    {['booked', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'].map((s) => (
                      <option key={s} value={s}>{t(s)}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

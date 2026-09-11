import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { formatMoney } from '../utils/format';
import { useAuth } from '../context/AuthContext';

const HEALTH_FORM_FIELDS = [
  'blood_type', 'allergies', 'chronic_diseases', 'disabilities', 'current_medications',
  'past_surgeries', 'family_medical_history', 'smoking_status', 'height_cm', 'weight_kg',
  'marital_status', 'occupation', 'nationality', 'insurance_provider', 'insurance_number',
  'emergency_contact_name', 'emergency_contact_phone', 'notes',
];

function emptyHealthForm() {
  return HEALTH_FORM_FIELDS.reduce((acc, f) => ({ ...acc, [f]: '' }), {});
}

export default function PatientProfile() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [patient, setPatient] = useState(null);
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [record, setRecord] = useState({ chief_complaint: '', diagnosis: '', notes: '' });
  const [editingHealth, setEditingHealth] = useState(false);
  const [healthForm, setHealthForm] = useState(emptyHealthForm());
  const isDoctor = user?.role === 'doctor' || user?.role === 'admin';
  const canEditHealth = ['admin', 'reception', 'doctor', 'nurse'].includes(user?.role);

  async function loadPatient() {
    const { data } = await api.get(`/patients/${id}`);
    setPatient(data);
  }

  useEffect(() => {
    loadPatient();
  }, [id]);

  async function handleAddRecord(e) {
    e.preventDefault();
    await api.post('/medical-records', { ...record, patient_id: id });
    setRecord({ chief_complaint: '', diagnosis: '', notes: '' });
    setShowRecordForm(false);
    loadPatient();
  }

  function startEditHealth() {
    const draft = {};
    HEALTH_FORM_FIELDS.forEach((f) => { draft[f] = patient[f] ?? ''; });
    setHealthForm(draft);
    setEditingHealth(true);
  }

  async function saveHealth(e) {
    e.preventDefault();
    await api.put(`/patients/${id}`, healthForm);
    setEditingHealth(false);
    loadPatient();
  }

  function bmi() {
    const h = Number(patient.height_cm);
    const w = Number(patient.weight_kg);
    if (!h || !w) return null;
    return (w / ((h / 100) ** 2)).toFixed(1);
  }

  if (!patient) return <div>...</div>;

  return (
    <div>
      <div className="card">
        <h2>{patient.full_name}</h2>
        <div className="grid-2">
          <div>{t('file_number')}: {patient.file_number}</div>
          <div>{t('phone')}: {patient.phone || '-'}</div>
          <div>{t('national_id')}: {patient.national_id || '-'}</div>
          <div>{t('date_of_birth')}: {patient.date_of_birth || '-'}</div>
          <div>{t('gender')}: {patient.gender ? t(patient.gender) : '-'}</div>
          <div>{t('address')}: {patient.address || '-'}</div>
        </div>
      </div>

      <div className="card">
        <div className="topbar">
          <h3>{t('health_record')}</h3>
          {canEditHealth && !editingHealth && (
            <button onClick={startEditHealth}>{t('edit_health_record')}</button>
          )}
        </div>

        {editingHealth ? (
          <form onSubmit={saveHealth}>
            <div className="section-title">{t('basic_health_info')}</div>
            <div className="grid-3">
              <div>
                <label>{t('blood_type')}</label>
                <select value={healthForm.blood_type} onChange={(e) => setHealthForm({ ...healthForm, blood_type: e.target.value })}>
                  <option value="">-</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label>{t('height_cm')}</label>
                <input type="number" min="0" step="0.1" value={healthForm.height_cm} onChange={(e) => setHealthForm({ ...healthForm, height_cm: e.target.value })} />
              </div>
              <div>
                <label>{t('weight_kg')}</label>
                <input type="number" min="0" step="0.1" value={healthForm.weight_kg} onChange={(e) => setHealthForm({ ...healthForm, weight_kg: e.target.value })} />
              </div>
              <div>
                <label>{t('smoking_status')}</label>
                <select value={healthForm.smoking_status} onChange={(e) => setHealthForm({ ...healthForm, smoking_status: e.target.value })}>
                  <option value="">-</option>
                  <option value="none">{t('non_smoker')}</option>
                  <option value="current">{t('current_smoker')}</option>
                  <option value="former">{t('former_smoker')}</option>
                </select>
              </div>
              <div>
                <label>{t('marital_status')}</label>
                <select value={healthForm.marital_status} onChange={(e) => setHealthForm({ ...healthForm, marital_status: e.target.value })}>
                  <option value="">-</option>
                  <option value="single">{t('single')}</option>
                  <option value="married">{t('married')}</option>
                  <option value="divorced">{t('divorced')}</option>
                  <option value="widowed">{t('widowed')}</option>
                </select>
              </div>
              <div>
                <label>{t('occupation')}</label>
                <input value={healthForm.occupation} onChange={(e) => setHealthForm({ ...healthForm, occupation: e.target.value })} />
              </div>
              <div>
                <label>{t('nationality')}</label>
                <input value={healthForm.nationality} onChange={(e) => setHealthForm({ ...healthForm, nationality: e.target.value })} />
              </div>
              <div>
                <label>{t('insurance_provider')}</label>
                <input value={healthForm.insurance_provider} onChange={(e) => setHealthForm({ ...healthForm, insurance_provider: e.target.value })} />
              </div>
              <div>
                <label>{t('insurance_number')}</label>
                <input value={healthForm.insurance_number} onChange={(e) => setHealthForm({ ...healthForm, insurance_number: e.target.value })} />
              </div>
            </div>

            <div className="section-title" style={{ marginTop: 16 }}>{t('medical_history')}</div>
            <div className="grid-2">
              <div>
                <label>{t('allergies')}</label>
                <textarea rows={2} value={healthForm.allergies} onChange={(e) => setHealthForm({ ...healthForm, allergies: e.target.value })} placeholder={t('allergies_placeholder')} />
              </div>
              <div>
                <label>{t('chronic_diseases')}</label>
                <textarea rows={2} value={healthForm.chronic_diseases} onChange={(e) => setHealthForm({ ...healthForm, chronic_diseases: e.target.value })} placeholder={t('chronic_diseases_placeholder')} />
              </div>
              <div>
                <label>{t('disabilities')}</label>
                <textarea rows={2} value={healthForm.disabilities} onChange={(e) => setHealthForm({ ...healthForm, disabilities: e.target.value })} placeholder={t('disabilities_placeholder')} />
              </div>
              <div>
                <label>{t('current_medications')}</label>
                <textarea rows={2} value={healthForm.current_medications} onChange={(e) => setHealthForm({ ...healthForm, current_medications: e.target.value })} />
              </div>
              <div>
                <label>{t('past_surgeries')}</label>
                <textarea rows={2} value={healthForm.past_surgeries} onChange={(e) => setHealthForm({ ...healthForm, past_surgeries: e.target.value })} />
              </div>
              <div>
                <label>{t('family_medical_history')}</label>
                <textarea rows={2} value={healthForm.family_medical_history} onChange={(e) => setHealthForm({ ...healthForm, family_medical_history: e.target.value })} />
              </div>
            </div>

            <div className="section-title" style={{ marginTop: 16 }}>{t('emergency_contact')}</div>
            <div className="grid-2">
              <div>
                <label>{t('emergency_contact_name')}</label>
                <input value={healthForm.emergency_contact_name} onChange={(e) => setHealthForm({ ...healthForm, emergency_contact_name: e.target.value })} />
              </div>
              <div>
                <label>{t('emergency_contact_phone')}</label>
                <input value={healthForm.emergency_contact_phone} onChange={(e) => setHealthForm({ ...healthForm, emergency_contact_phone: e.target.value })} />
              </div>
            </div>

            <div>
              <label>{t('notes')}</label>
              <textarea rows={2} value={healthForm.notes} onChange={(e) => setHealthForm({ ...healthForm, notes: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit">{t('save')}</button>
              <button type="button" className="secondary" onClick={() => setEditingHealth(false)}>{t('cancel')}</button>
            </div>
          </form>
        ) : (
          <div>
            <div className="grid-3" style={{ marginBottom: 8 }}>
              <div><span className="muted">{t('blood_type')}:</span> {patient.blood_type || '-'}</div>
              <div><span className="muted">{t('height_cm')} / {t('weight_kg')}:</span> {patient.height_cm || '-'} / {patient.weight_kg || '-'} {bmi() && <span className="muted">(BMI {bmi()})</span>}</div>
              <div><span className="muted">{t('smoking_status')}:</span> {patient.smoking_status ? t(patient.smoking_status === 'none' ? 'non_smoker' : patient.smoking_status === 'current' ? 'current_smoker' : 'former_smoker') : '-'}</div>
              <div><span className="muted">{t('marital_status')}:</span> {patient.marital_status ? t(patient.marital_status) : '-'}</div>
              <div><span className="muted">{t('occupation')}:</span> {patient.occupation || '-'}</div>
              <div><span className="muted">{t('nationality')}:</span> {patient.nationality || '-'}</div>
              <div><span className="muted">{t('insurance_provider')}:</span> {patient.insurance_provider || '-'}</div>
              <div><span className="muted">{t('insurance_number')}:</span> {patient.insurance_number || '-'}</div>
            </div>

            <div className="section-title">{t('medical_history')}</div>
            <div style={{ marginBottom: 8 }}>
              <div><strong>{t('allergies')}:</strong> {patient.allergies || '-'}</div>
              <div><strong>{t('chronic_diseases')}:</strong> {patient.chronic_diseases || '-'}</div>
              <div><strong>{t('disabilities')}:</strong> {patient.disabilities || '-'}</div>
              <div><strong>{t('current_medications')}:</strong> {patient.current_medications || '-'}</div>
              <div><strong>{t('past_surgeries')}:</strong> {patient.past_surgeries || '-'}</div>
              <div><strong>{t('family_medical_history')}:</strong> {patient.family_medical_history || '-'}</div>
            </div>

            <div className="section-title">{t('emergency_contact')}</div>
            <div>{patient.emergency_contact_name || '-'} — {patient.emergency_contact_phone || '-'}</div>

            {patient.notes && (
              <>
                <div className="section-title" style={{ marginTop: 8 }}>{t('notes')}</div>
                <div className="muted">{patient.notes}</div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <div className="topbar">
          <h3>{t('medical_records')}</h3>
          {isDoctor && (
            <button onClick={() => setShowRecordForm(!showRecordForm)}>{t('add_record')}</button>
          )}
        </div>

        {showRecordForm && (
          <form onSubmit={handleAddRecord} style={{ marginBottom: 16 }}>
            <label>{t('chief_complaint')}</label>
            <textarea
              rows={2}
              value={record.chief_complaint}
              onChange={(e) => setRecord({ ...record, chief_complaint: e.target.value })}
            />
            <label>{t('diagnosis')}</label>
            <textarea
              rows={2}
              value={record.diagnosis}
              onChange={(e) => setRecord({ ...record, diagnosis: e.target.value })}
            />
            <button type="submit">{t('save')}</button>
          </form>
        )}

        {(patient.MedicalRecords || []).map((r) => (
          <div key={r.id} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
            <div className="muted" style={{ fontSize: 12 }}>
              {new Date(r.visit_date).toLocaleString('en-GB')} — د. {r.doctor?.full_name}
            </div>
            <div><strong>{t('chief_complaint')}:</strong> {r.chief_complaint || '-'}</div>
            <div><strong>{t('diagnosis')}:</strong> {r.diagnosis || '-'}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>{t('billing')}</h3>
        <table>
          <thead>
            <tr>
              <th>{t('invoice_number')}</th>
              <th>{t('total_amount')}</th>
              <th>{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            {(patient.Invoices || []).map((inv) => (
              <tr key={inv.id}>
                <td>{inv.invoice_number}</td>
                <td>{formatMoney(inv.total_amount)}</td>
                <td><span className={`badge ${inv.status}`}>{t(inv.status)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatMoney as fmt } from '../utils/format';

const MEMBER_TYPES = ['citizen', 'staff', 'dependent'];
const RELATIONS = ['spouse', 'child', 'parent'];

const emptyMemberForm = {
  plan_id: '', member_type: 'citizen', full_name: '', national_id: '', date_of_birth: '',
  gender: '', phone: '', relation: '', related_staff_id: '', notes: '',
};
const emptyPlanForm = {
  name_ar: '', name_en: '', category: 'citizen', coverage_percentage: 70,
  monthly_premium: 0, annual_max_coverage: '', description_ar: '', insurance_company_id: '',
};

export default function Insurance() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canManageMembers = ['admin', 'billing', 'reception'].includes(user?.role);
  const canCollectPremium = ['admin', 'billing'].includes(user?.role);

  const [plans, setPlans] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [members, setMembers] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [search, setSearch] = useState('');
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [memberForm, setMemberForm] = useState(emptyMemberForm);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const [cardMember, setCardMember] = useState(null);
  const [collectingId, setCollectingId] = useState(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMsg, setCollectMsg] = useState('');

  async function loadPlans() {
    const { data } = await api.get('/insurance/plans');
    setPlans(data);
  }

  async function loadMembers(q = '') {
    const { data } = await api.get('/insurance/members', { params: { search: q } });
    setMembers(data);
  }

  useEffect(() => {
    loadPlans();
    if (canManageMembers) {
      loadMembers();
      api.get('/users/doctors').then((res) => setStaffList(res.data)).catch(() => {});
    }
    if (isAdmin) {
      api.get('/insurance-companies').then((res) => setCompanies(res.data)).catch(() => {});
    }
  }, []);

  async function handleAddPlan(e) {
    e.preventDefault();
    await api.post('/insurance/plans', {
      ...planForm,
      annual_max_coverage: planForm.annual_max_coverage || null,
      insurance_company_id: planForm.insurance_company_id || null,
    });
    setPlanForm(emptyPlanForm);
    setShowPlanForm(false);
    loadPlans();
  }

  async function handleAddMember(e) {
    e.preventDefault();
    await api.post('/insurance/members', memberForm);
    setMemberForm(emptyMemberForm);
    setShowMemberForm(false);
    loadMembers(search);
  }

  async function updateMemberStatus(m, status) {
    await api.put(`/insurance/members/${m.id}`, { status });
    loadMembers(search);
  }

  function startCollect(m) {
    setCollectingId(m.id);
    setCollectAmount(String(m.plan?.monthly_premium || 0));
    setCollectMsg('');
  }

  async function submitCollect(m) {
    try {
      await api.post(`/insurance/members/${m.id}/collect-premium`, { amount: Number(collectAmount) });
      setCollectMsg(t('premium_collected_success'));
      setCollectingId(null);
    } catch (err) {
      setCollectMsg(err.response?.data?.message || t('save_failed'));
    }
  }

  // بطاقة تأمين قابلة للطباعة تتضمّن باركودًا حقيقيًا لرقم البوليصة (لمسحه سريعًا عند الاستقبال أو الفوترة)
  // تُستخدم إطارًا مخفيًا (iframe) بدل نافذة منبثقة لتفادي حظر المتصفح للنوافذ المنبثقة
  function printCard(m) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>${t('insurance_card')}</title>
        </head>
        <body style="font-family: Tahoma, Arial, sans-serif; padding: 20px;">
          <div style="width:340px; border:2px solid #2563eb; border-radius:14px; padding:18px; background:#fff;">
            <div style="font-weight:bold; font-size:15px; color:#2563eb;">🛡️ ${t('insurance_card')} — Starlight</div>
            <div style="margin-top:10px; font-size:13px;">${t('full_name')}: <strong>${m.full_name}</strong></div>
            <div style="font-size:13px;">${t('policy_number')}: <strong>${m.policy_number}</strong></div>
            <div style="font-size:13px;">${t('insurance_plan')}: ${m.plan?.name_ar || '-'}</div>
            <div style="font-size:13px;">${t('coverage_percentage')}: ${m.coverage_percentage}%</div>
            <div style="font-size:13px;">${t('member_type')}: ${t(`member_type_${m.member_type}`)}</div>
            <div style="font-size:13px;">${t('status')}: ${t(m.status)}</div>
            <div style="margin-top:14px; text-align:center;">
              <svg id="barcode"></svg>
            </div>
          </div>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
          <script>
            JsBarcode("#barcode", ${JSON.stringify(m.policy_number)}, { format: "CODE128", height: 55, fontSize: 14, margin: 6 });
            window.focus();
            window.print();
          </script>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => document.body.removeChild(iframe), 3000);
  }

  const staffTypeCount = members.filter((m) => m.member_type === 'staff').length;
  const dependentTypeCount = members.filter((m) => m.member_type === 'dependent').length;
  const citizenTypeCount = members.filter((m) => m.member_type === 'citizen').length;

  return (
    <div>
      <div className="topbar">
        <h2>🛡️ {t('health_insurance')}</h2>
      </div>

      {/* شرح النموذج ومميزات النظام - ما يميّز هذا النظام عن غيره */}
      <div className="card">
        <div className="section-title">{t('insurance_intro_title')}</div>
        <p style={{ lineHeight: 1.8, fontSize: 14 }}>{t('insurance_intro_body')}</p>

        <div className="section-title" style={{ marginTop: 16 }}>{t('insurance_model_title')}</div>
        <p style={{ lineHeight: 1.8, fontSize: 14 }}>{t('insurance_model_body')}</p>

        <div className="grid-3" style={{ marginTop: 12 }}>
          <div className="dept-card" style={{ margin: 0 }}>
            <strong>✅ {t('benefit_universal_title')}</strong>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t('benefit_universal_body')}</p>
          </div>
          <div className="dept-card" style={{ margin: 0 }}>
            <strong>✅ {t('benefit_cap_title')}</strong>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t('benefit_cap_body')}</p>
          </div>
          <div className="dept-card" style={{ margin: 0 }}>
            <strong>✅ {t('benefit_staff_title')}</strong>
            <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t('benefit_staff_body')}</p>
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 16 }}>{t('future_suggestions_title')}</div>
        <ul style={{ lineHeight: 2, fontSize: 13.5, paddingInlineStart: 20 }}>
          <li>{t('suggestion_1')}</li>
          <li>{t('suggestion_2')}</li>
          <li>{t('suggestion_3')}</li>
          <li>{t('suggestion_4')}</li>
          <li>{t('suggestion_5')}</li>
        </ul>
      </div>

      {/* الخطط */}
      <div className="topbar" style={{ marginTop: 8 }}>
        <h3>{t('insurance_plans')}</h3>
        {isAdmin && <button onClick={() => setShowPlanForm(!showPlanForm)}>+ {t('add_plan')}</button>}
      </div>

      {showPlanForm && isAdmin && (
        <form className="card" onSubmit={handleAddPlan}>
          <div className="grid-3">
            <div>
              <label>{t('plan_name_ar')}</label>
              <input required value={planForm.name_ar} onChange={(e) => setPlanForm({ ...planForm, name_ar: e.target.value })} />
            </div>
            <div>
              <label>{t('plan_name_en')}</label>
              <input required value={planForm.name_en} onChange={(e) => setPlanForm({ ...planForm, name_en: e.target.value })} />
            </div>
            <div>
              <label>{t('plan_category')}</label>
              <select value={planForm.category} onChange={(e) => setPlanForm({ ...planForm, category: e.target.value })}>
                <option value="citizen">{t('member_type_citizen')}</option>
                <option value="staff">{t('member_type_staff')}</option>
                <option value="dependent">{t('member_type_dependent')}</option>
              </select>
            </div>
            <div>
              <label>{t('coverage_percentage')}</label>
              <input type="number" min="0" max="100" value={planForm.coverage_percentage} onChange={(e) => setPlanForm({ ...planForm, coverage_percentage: Number(e.target.value) })} />
            </div>
            <div>
              <label>{t('monthly_premium')}</label>
              <input type="number" min="0" value={planForm.monthly_premium} onChange={(e) => setPlanForm({ ...planForm, monthly_premium: Number(e.target.value) })} />
            </div>
            <div>
              <label>{t('annual_max_coverage')}</label>
              <input type="number" min="0" value={planForm.annual_max_coverage} placeholder={t('no_limit')} onChange={(e) => setPlanForm({ ...planForm, annual_max_coverage: e.target.value })} />
            </div>
            <div>
              <label>{t('insurance_company')}</label>
              <select value={planForm.insurance_company_id} onChange={(e) => setPlanForm({ ...planForm, insurance_company_id: e.target.value })}>
                <option value="">{t('internal_hospital_plan')}</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label>{t('plan_description')}</label>
            <textarea rows={2} value={planForm.description_ar} onChange={(e) => setPlanForm({ ...planForm, description_ar: e.target.value })} />
          </div>
          <button type="submit">{t('save')}</button>
        </form>
      )}

      <div className="stat-grid">
        {plans.map((p) => (
          <div className="stat-card" key={p.id}>
            <div className="stat-label">{p.name_ar}</div>
            <div className="stat-value" style={{ fontSize: 24 }}>{p.coverage_percentage}%</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {t('monthly_premium')}: {fmt(p.monthly_premium)} | {t('annual_max_coverage')}: {p.annual_max_coverage ? fmt(p.annual_max_coverage) : t('no_limit')}
            </div>
            {p.description_ar && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{p.description_ar}</div>}
            <div style={{ marginTop: 8 }}>
              <span className={`tag ${p.InsuranceCompany ? '' : ''}`} style={p.InsuranceCompany ? undefined : { background: 'var(--success-bg)', color: 'var(--success-text)' }}>
                {p.InsuranceCompany ? `🏢 ${p.InsuranceCompany.name_ar}` : `🏥 ${t('internal_hospital_plan')}`}
              </span>
            </div>
          </div>
        ))}
      </div>

      {canManageMembers && (
        <>
          {/* الأعضاء المؤمَّنون */}
          <div className="topbar" style={{ marginTop: 8 }}>
            <h3>{t('insured_members')}</h3>
            <button onClick={() => setShowMemberForm(!showMemberForm)}>+ {t('add_member')}</button>
          </div>

          <div className="stat-grid">
            <div className="stat-card"><div className="stat-label">{t('member_type_citizen')}</div><div className="stat-value">{citizenTypeCount}</div></div>
            <div className="stat-card"><div className="stat-label">{t('member_type_staff')}</div><div className="stat-value">{staffTypeCount}</div></div>
            <div className="stat-card"><div className="stat-label">{t('member_type_dependent')}</div><div className="stat-value">{dependentTypeCount}</div></div>
          </div>

          {showMemberForm && (
            <form className="card" onSubmit={handleAddMember}>
              <div className="grid-3">
                <div>
                  <label>{t('insurance_plan')}</label>
                  <select required value={memberForm.plan_id} onChange={(e) => setMemberForm({ ...memberForm, plan_id: e.target.value })}>
                    <option value="">-</option>
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.name_ar} ({p.coverage_percentage}%)</option>)}
                  </select>
                </div>
                <div>
                  <label>{t('member_type')}</label>
                  <select value={memberForm.member_type} onChange={(e) => setMemberForm({ ...memberForm, member_type: e.target.value })}>
                    {MEMBER_TYPES.map((mt) => <option key={mt} value={mt}>{t(`member_type_${mt}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label>{t('full_name')}</label>
                  <input required value={memberForm.full_name} onChange={(e) => setMemberForm({ ...memberForm, full_name: e.target.value })} />
                </div>
                <div>
                  <label>{t('national_id')}</label>
                  <input value={memberForm.national_id} onChange={(e) => setMemberForm({ ...memberForm, national_id: e.target.value })} />
                </div>
                <div>
                  <label>{t('date_of_birth')}</label>
                  <input type="date" value={memberForm.date_of_birth} onChange={(e) => setMemberForm({ ...memberForm, date_of_birth: e.target.value })} />
                </div>
                <div>
                  <label>{t('gender')}</label>
                  <select value={memberForm.gender} onChange={(e) => setMemberForm({ ...memberForm, gender: e.target.value })}>
                    <option value="">-</option>
                    <option value="male">{t('male')}</option>
                    <option value="female">{t('female')}</option>
                  </select>
                </div>
                <div>
                  <label>{t('phone')}</label>
                  <input value={memberForm.phone} onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })} />
                </div>
                {memberForm.member_type === 'dependent' && (
                  <>
                    <div>
                      <label>{t('relation')}</label>
                      <select value={memberForm.relation} onChange={(e) => setMemberForm({ ...memberForm, relation: e.target.value })}>
                        <option value="">-</option>
                        {RELATIONS.map((r) => <option key={r} value={r}>{t(`relation_${r}`)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>{t('related_staff')}</label>
                      <select value={memberForm.related_staff_id} onChange={(e) => setMemberForm({ ...memberForm, related_staff_id: e.target.value })}>
                        <option value="">-</option>
                        {staffList.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                      </select>
                    </div>
                  </>
                )}
                {memberForm.member_type === 'staff' && (
                  <div>
                    <label>{t('related_staff')}</label>
                    <select value={memberForm.related_staff_id} onChange={(e) => setMemberForm({ ...memberForm, related_staff_id: e.target.value })}>
                      <option value="">-</option>
                      {staffList.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <button type="submit">{t('save')}</button>
            </form>
          )}

          {collectMsg && <div className="card muted">{collectMsg}</div>}

          <form className="card" onSubmit={(e) => { e.preventDefault(); loadMembers(search); }} style={{ display: 'flex', gap: 8 }}>
            <input placeholder={t('search_by_name_or_policy')} value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 0 }} />
            <button type="submit">{t('search')}</button>
          </form>

          <div className="card" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{t('policy_number')}</th>
                  <th>{t('full_name')}</th>
                  <th>{t('member_type')}</th>
                  <th>{t('insurance_plan')}</th>
                  <th>{t('coverage_percentage')}</th>
                  <th>{t('used_amount_this_year')}</th>
                  <th>{t('status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.policy_number}</td>
                    <td>{m.full_name}{m.relation ? ` (${t(`relation_${m.relation}`)})` : ''}</td>
                    <td>{t(`member_type_${m.member_type}`)}</td>
                    <td>{m.plan?.name_ar}</td>
                    <td>{m.coverage_percentage}%</td>
                    <td>{fmt(m.used_amount_this_year)}{m.annual_max_coverage ? ` / ${fmt(m.annual_max_coverage)}` : ''}</td>
                    <td><span className={`badge ${m.status === 'active' ? 'active' : m.status === 'suspended' ? 'low-stock' : 'inactive'}`}>{t(m.status)}</span></td>
                    <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button className="secondary" onClick={() => printCard(m)}>🪪 {t('print_card')}</button>
                      {m.status === 'active' ? (
                        <button className="danger" onClick={() => updateMemberStatus(m, 'suspended')}>{t('suspend')}</button>
                      ) : (
                        <button onClick={() => updateMemberStatus(m, 'active')}>{t('reactivate')}</button>
                      )}
                      {canCollectPremium && (
                        collectingId === m.id ? (
                          <>
                            <input
                              type="number" min="0" step="0.01"
                              value={collectAmount}
                              onChange={(e) => setCollectAmount(e.target.value)}
                              style={{ width: 90, marginBottom: 0 }}
                            />
                            <button onClick={() => submitCollect(m)}>{t('confirm')}</button>
                            <button className="secondary" onClick={() => setCollectingId(null)}>{t('cancel')}</button>
                          </>
                        ) : (
                          <button className="secondary" onClick={() => startCollect(m)}>💵 {t('collect_premium')}</button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr><td colSpan={8} className="muted">{t('no_data')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

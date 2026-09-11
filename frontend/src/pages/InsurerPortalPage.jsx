import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { formatMoney as fmt } from '../utils/format';

const API_BASE = '/api/insurer-portal';

// بوابة شركة التأمين الخارجية - صفحة مستقلة عامة (لا تتطلب تسجيل دخول داخل النظام)، تُستخدم
// من موظف شركة التأمين نفسه عبر مفتاح API الخاص بشركته فقط - منفصلة تمامًا عن نظام JWT الداخلي
export default function InsurerPortalPage() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('insurer_api_key') || '');
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('coverage');

  // التحقق من التغطية
  const [policyNumber, setPolicyNumber] = useState('');
  const [coverageResult, setCoverageResult] = useState(null);
  const [coverageError, setCoverageError] = useState('');
  const [checkingCoverage, setCheckingCoverage] = useState(false);

  // المطالبات
  const [claims, setClaims] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [respondingId, setRespondingId] = useState(null);
  const [decision, setDecision] = useState('approved');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [respondMsg, setRespondMsg] = useState('');

  async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'حدث خطأ');
    return data;
  }

  function handleLogin(e) {
    e.preventDefault();
    setError('');
    localStorage.setItem('insurer_api_key', keyInput.trim());
    setApiKey(keyInput.trim());
  }

  function handleLogout() {
    localStorage.removeItem('insurer_api_key');
    setApiKey('');
    setKeyInput('');
    setClaims([]);
    setCoverageResult(null);
  }

  async function loadClaims() {
    try {
      const data = await apiFetch(`/claims${statusFilter ? `?status=${statusFilter}` : ''}`);
      setClaims(data);
      setError('');
    } catch (err) {
      setError(err.message);
      if (err.message.includes('صالح') || err.message.includes('مفعّلة')) handleLogout();
    }
  }

  useEffect(() => {
    if (apiKey && tab === 'claims') loadClaims();
  }, [apiKey, tab, statusFilter]);

  async function checkCoverage(e) {
    e.preventDefault();
    setCheckingCoverage(true);
    setCoverageError('');
    setCoverageResult(null);
    try {
      const data = await apiFetch(`/verify-coverage?policy_number=${encodeURIComponent(policyNumber)}`);
      setCoverageResult(data);
    } catch (err) {
      setCoverageError(err.message);
    }
    setCheckingCoverage(false);
  }

  async function submitRespond(claimId) {
    setRespondMsg('');
    try {
      const body = { decision };
      if (decision !== 'rejected') body.amount_approved = decision === 'approved' ? undefined : Number(approvedAmount);
      if (decision === 'rejected') body.rejection_reason = rejectionReason;
      await apiFetch(`/claims/${claimId}/respond`, { method: 'PUT', body: JSON.stringify(body) });
      setRespondingId(null);
      setApprovedAmount('');
      setRejectionReason('');
      loadClaims();
    } catch (err) {
      setRespondMsg(err.message);
    }
  }

  const STATUS_LABEL = {
    submitted: 'قُدِّمت', under_review: 'قيد المراجعة', approved: 'موافقة كاملة',
    partially_approved: 'موافقة جزئية', rejected: 'مرفوضة', paid: 'مسدَّدة',
  };
  const STATUS_BADGE = {
    submitted: 'low-stock', under_review: 'low-stock', approved: 'active',
    partially_approved: 'active', rejected: 'inactive', paid: 'active',
  };

  if (!apiKey) {
    return (
      <div className="login-page">
        <button type="button" className="secondary login-theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <div className="login-box">
          <div className="brand" style={{ marginBottom: 20 }}>
            <span className="logo-dot" />
            <div>
              <h1 style={{ color: 'var(--text)' }}>بوابة شركة التأمين</h1>
              <div className="brand-by" style={{ color: 'var(--text-muted)' }}>
                بواسطة <span className="brand-name">Starlight</span>
              </div>
            </div>
          </div>
          <form onSubmit={handleLogin}>
            <label>مفتاح API الخاص بشركتكم</label>
            <input required value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="أدخل مفتاح API المُسلَّم من إدارة المستشفى" />
            {error && <div className="error-text">{error}</div>}
            <button type="submit" style={{ width: '100%' }}>دخول</button>
          </form>
          <p className="muted" style={{ fontSize: 12, marginTop: 16, lineHeight: 1.7 }}>
            هذه بوابة مستقلة مخصّصة لشركات التأمين المتعاقدة فقط، منفصلة عن نظام تسجيل دخول موظفي المستشفى.
            يُصدر مفتاح API من إدارة المستشفى (صفحة "شركات التأمين").
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px' }}>
      <div className="topbar" style={{ maxWidth: 1100, margin: '0 auto 16px' }}>
        <h2>🏢 بوابة شركة التأمين</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="secondary theme-toggle" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          <button type="button" className="secondary" onClick={handleLogout}>تسجيل الخروج</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="tag-list" style={{ marginBottom: 16 }}>
          <button type="button" className={tab === 'coverage' ? '' : 'secondary'} onClick={() => setTab('coverage')}>التحقق من التغطية</button>
          <button type="button" className={tab === 'claims' ? '' : 'secondary'} onClick={() => setTab('claims')}>المطالبات</button>
        </div>

        {error && <div className="card error-text">{error}</div>}

        {tab === 'coverage' && (
          <div className="card">
            <div className="section-title">التحقق الفوري من تغطية مشترك</div>
            <form onSubmit={checkCoverage} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label>رقم البوليصة</label>
                <input required value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} placeholder="مثال: INS-2026-000003" style={{ marginBottom: 0 }} />
              </div>
              <button type="submit" disabled={checkingCoverage}>{checkingCoverage ? 'جارٍ التحقق...' : 'تحقق'}</button>
            </form>

            {coverageError && <div className="error-text">{coverageError}</div>}

            {coverageResult && (
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-label">الاسم الكامل</div>
                  <div className="stat-value" style={{ fontSize: 18 }}>{coverageResult.full_name}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">حالة التغطية</div>
                  <div className="stat-value" style={{ fontSize: 18, color: coverageResult.is_covered ? 'var(--success-text)' : 'var(--danger-text)' }}>
                    {coverageResult.is_covered ? '✅ فعّالة' : '❌ غير فعّالة'}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">نسبة التغطية</div>
                  <div className="stat-value">{coverageResult.coverage_percentage}%</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">المتبقي من السقف السنوي</div>
                  <div className="stat-value">{coverageResult.remaining_coverage !== null ? fmt(coverageResult.remaining_coverage) : 'بلا حد'}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">المستخدم هذا العام</div>
                  <div className="stat-value">{fmt(coverageResult.used_amount_this_year)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">الخطة</div>
                  <div className="stat-value" style={{ fontSize: 16 }}>{coverageResult.plan_name}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'claims' && (
          <div className="card" style={{ overflowX: 'auto' }}>
            <div className="tag-list" style={{ marginBottom: 12 }}>
              <button type="button" className={statusFilter === '' ? '' : 'secondary'} onClick={() => setStatusFilter('')}>الكل</button>
              {Object.keys(STATUS_LABEL).map((s) => (
                <button key={s} type="button" className={statusFilter === s ? '' : 'secondary'} onClick={() => setStatusFilter(s)}>{STATUS_LABEL[s]}</button>
              ))}
            </div>
            {respondMsg && <div className="error-text">{respondMsg}</div>}
            <table>
              <thead>
                <tr>
                  <th>رقم المطالبة</th>
                  <th>المريض</th>
                  <th>رقم الفاتورة</th>
                  <th>المبلغ المطالَب به</th>
                  <th>المبلغ المعتمد</th>
                  <th>الحالة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id}>
                    <td>{c.claim_number}</td>
                    <td>{c.InsuranceMember?.full_name}</td>
                    <td>{c.Invoice?.invoice_number}</td>
                    <td>{fmt(c.amount_claimed)}</td>
                    <td>{c.amount_approved !== null ? fmt(c.amount_approved) : '-'}</td>
                    <td><span className={`badge ${STATUS_BADGE[c.status]}`}>{STATUS_LABEL[c.status]}</span></td>
                    <td>
                      {['submitted', 'under_review'].includes(c.status) && (
                        respondingId === c.id ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <select value={decision} onChange={(e) => setDecision(e.target.value)} style={{ width: 130, marginBottom: 0 }}>
                              <option value="approved">موافقة كاملة</option>
                              <option value="partially_approved">موافقة جزئية</option>
                              <option value="rejected">رفض</option>
                            </select>
                            {decision === 'partially_approved' && (
                              <input type="number" min="0" max={c.amount_claimed} placeholder="المبلغ المعتمد" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} style={{ width: 110, marginBottom: 0 }} />
                            )}
                            {decision === 'rejected' && (
                              <input placeholder="سبب الرفض" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} style={{ width: 120, marginBottom: 0 }} />
                            )}
                            <button type="button" onClick={() => submitRespond(c.id)}>تأكيد</button>
                            <button type="button" className="secondary" onClick={() => setRespondingId(null)}>إلغاء</button>
                          </div>
                        ) : (
                          <button type="button" className="secondary" onClick={() => { setRespondingId(c.id); setDecision('approved'); }}>الرد على المطالبة</button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
                {claims.length === 0 && <tr><td colSpan={7} className="muted">لا توجد بيانات</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

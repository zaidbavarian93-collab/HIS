import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';

const ACTION_BADGE = {
  login_success: 'active', login_failed: 'inactive',
  create: 'active', update: 'low-stock', delete: 'inactive',
  approve: 'active', reject: 'inactive', pay: 'active', collect_premium: 'active',
  check_in: 'active', check_out: 'active',
};

export default function AuditLogs() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState({ entity_types: [], actions: [] });
  const [filters, setFilters] = useState({ action: '', entity_type: '', from: '', to: '', search: '' });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  async function loadLogs() {
    setLoading(true);
    try {
      const { data } = await api.get('/audit-logs', {
        params: { ...filters, page, limit: 50 },
      });
      setLogs(data.rows);
      setPages(data.pages);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.get('/audit-logs/meta').then((res) => setMeta(res.data)).catch(() => {});
  }, []);

  useEffect(() => { loadLogs(); }, [filters, page]);

  function updateFilter(field, value) {
    setPage(1);
    setFilters({ ...filters, [field]: value });
  }

  return (
    <div>
      <div className="topbar">
        <h2>🛡️ {t('audit_log')}</h2>
      </div>

      <div className="card muted" style={{ fontSize: 12.5, marginBottom: 16 }}>{t('audit_log_hint')}</div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid-3">
          <div>
            <label>{t('action')}</label>
            <select value={filters.action} onChange={(e) => updateFilter('action', e.target.value)}>
              <option value="">{t('all_categories')}</option>
              {meta.actions.map((a) => <option key={a} value={a}>{t(`audit_action_${a}`, a)}</option>)}
            </select>
          </div>
          <div>
            <label>{t('entity_type')}</label>
            <select value={filters.entity_type} onChange={(e) => updateFilter('entity_type', e.target.value)}>
              <option value="">{t('all_categories')}</option>
              {meta.entity_types.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label>{t('search')}</label>
            <input value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} placeholder={t('search_in_description')} />
          </div>
          <div>
            <label>{t('from_date')}</label>
            <input type="date" value={filters.from} onChange={(e) => updateFilter('from', e.target.value)} />
          </div>
          <div>
            <label>{t('to_date')}</label>
            <input type="date" value={filters.to} onChange={(e) => updateFilter('to', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">{t('total_events')}</div>
          <div className="stat-value">{total}</div>
        </div>
      </div>

      {loading && <div className="muted">{t('loading')}</div>}

      {!loading && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('user')}</th>
                <th>{t('role_label')}</th>
                <th>{t('action')}</th>
                <th>{t('entity_type')}</th>
                <th>{t('details')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <>
                  <tr key={log.id}>
                    <td style={{ fontSize: 12.5 }}>{new Date(log.createdAt).toLocaleString('en-GB')}</td>
                    <td>{log.user_name || '-'}</td>
                    <td>{log.user_role ? t(`role_${log.user_role}`, log.user_role) : '-'}</td>
                    <td><span className={`badge ${ACTION_BADGE[log.action] || 'low-stock'}`}>{t(`audit_action_${log.action}`, log.action)}</span></td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{log.entity_type}</td>
                    <td style={{ fontSize: 13 }}>{log.description}</td>
                    <td>
                      {(log.before_data || log.after_data) && (
                        <button
                          type="button"
                          className="secondary"
                          style={{ padding: '3px 9px', fontSize: 11 }}
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        >
                          {expandedId === log.id ? t('close') : t('view_changes')}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr>
                      <td colSpan={7}>
                        <div className="grid-2" style={{ fontSize: 12, background: 'var(--bg)', padding: 10, borderRadius: 8 }}>
                          {log.before_data && (
                            <div>
                              <strong>{t('before')}:</strong>
                              <pre style={{ whiteSpace: 'pre-wrap', margin: '4px 0' }}>{JSON.stringify(log.before_data, null, 2)}</pre>
                            </div>
                          )}
                          {log.after_data && (
                            <div>
                              <strong>{t('after')}:</strong>
                              <pre style={{ whiteSpace: 'pre-wrap', margin: '4px 0' }}>{JSON.stringify(log.after_data, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {logs.length === 0 && <tr><td colSpan={7} className="muted">{t('no_data')}</td></tr>}
            </tbody>
          </table>

          {pages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
              <span className="muted" style={{ fontSize: 13, alignSelf: 'center' }}>{page} / {pages}</span>
              <button className="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>›</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

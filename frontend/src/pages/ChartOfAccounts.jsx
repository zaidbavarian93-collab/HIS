import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { formatNumber } from '../utils/format';

const TYPE_LABELS_KEY = {
  asset: 'account_type_asset', liability: 'account_type_liability',
  equity: 'account_type_equity', revenue: 'account_type_revenue', expense: 'account_type_expense',
};

function buildTree(accounts) {
  const byId = {};
  accounts.forEach((a) => { byId[a.id] = { ...a, children: [] }; });
  const roots = [];
  accounts.forEach((a) => {
    if (a.parent_id && byId[a.parent_id]) {
      byId[a.parent_id].children.push(byId[a.id]);
    } else {
      roots.push(byId[a.id]);
    }
  });
  return roots;
}

function AccountRow({ node, depth, expanded, toggle, t }) {
  const isExpanded = expanded[node.id] !== false; // مفتوح افتراضيًا
  const hasChildren = node.children.length > 0;

  return (
    <>
      <tr>
        <td style={{ paddingInlineStart: depth * 22 + 10 }}>
          {hasChildren && (
            <button
              type="button"
              className="secondary"
              style={{ padding: '2px 8px', marginInlineEnd: 6, fontSize: 11 }}
              onClick={() => toggle(node.id)}
            >
              {isExpanded ? '▾' : '◂'}
            </button>
          )}
          <span style={{ fontWeight: node.is_group ? 700 : 400 }}>{node.code} — {node.name_ar}</span>
        </td>
        <td>{t(TYPE_LABELS_KEY[node.type])}</td>
        <td>{node.is_group ? <span className="muted">{t('group_account')}</span> : (node.normal_balance === 'debit' ? t('debit') : t('credit'))}</td>
        <td style={{ fontWeight: node.is_group ? 700 : 400 }}>{formatNumber(node.balance)}</td>
      </tr>
      {hasChildren && isExpanded && node.children.map((child) => (
        <AccountRow key={child.id} node={child} depth={depth + 1} expanded={expanded} toggle={toggle} t={t} />
      ))}
    </>
  );
}

export default function ChartOfAccounts() {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState([]);
  const [expanded, setExpanded] = useState({});

  async function loadAccounts() {
    const { data } = await api.get('/accounting/accounts');
    setAccounts(data);
  }

  useEffect(() => { loadAccounts(); }, []);

  function toggle(id) {
    setExpanded((prev) => ({ ...prev, [id]: prev[id] === false ? true : false }));
  }

  const tree = buildTree(accounts);
  const totalAssets = accounts.filter((a) => a.type === 'asset' && !a.is_group).reduce((s, a) => s + Number(a.balance), 0);
  const totalLiabilities = accounts.filter((a) => a.type === 'liability' && !a.is_group).reduce((s, a) => s + Number(a.balance), 0);
  const totalRevenue = accounts.filter((a) => a.type === 'revenue' && !a.is_group).reduce((s, a) => s + Number(a.balance), 0);
  const totalExpense = accounts.filter((a) => a.type === 'expense' && !a.is_group).reduce((s, a) => s + Number(a.balance), 0);

  return (
    <div>
      <div className="topbar">
        <h2>{t('chart_of_accounts')}</h2>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">{t('account_type_asset')}</div>
          <div className="stat-value">{formatNumber(totalAssets)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('account_type_liability')}</div>
          <div className="stat-value">{formatNumber(totalLiabilities)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('account_type_revenue')}</div>
          <div className="stat-value">{formatNumber(totalRevenue)}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-label">{t('account_type_expense')}</div>
          <div className="stat-value">{formatNumber(totalExpense)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('net_result')}</div>
          <div className="stat-value">{formatNumber(totalRevenue - totalExpense)}</div>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>{t('account_name')}</th>
              <th>{t('account_type')}</th>
              <th>{t('normal_balance')}</th>
              <th>{t('balance')}</th>
            </tr>
          </thead>
          <tbody>
            {tree.map((root) => (
              <AccountRow key={root.id} node={root} depth={0} expanded={expanded} toggle={toggle} t={t} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

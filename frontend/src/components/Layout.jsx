import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { setLanguage } from '../i18n';

// القائمة الجانبية مقسّمة إلى فئات واضحة، كل فئة لها عنوان وفاصل
const NAV_GROUPS = [
  {
    key: 'overview',
    items: [
      { to: '/', label: 'dashboard', icon: '🏠', roles: null },
      { to: '/kpis', label: 'kpi_dashboard', icon: '📊', roles: ['admin', 'management', 'billing'] },
      { to: '/admin-activity', label: 'admin_activity_center', icon: '🖥️', roles: ['admin', 'billing'] },
      { to: '/notifications-center', label: 'notifications_center', icon: '🔔', roles: ['admin', 'billing', 'reception'] },
    ],
  },
  {
    // قسم مستقل خاص بالتأمين الصحي: التغطية الداخلية، شركات التأمين المتعاقدة، ومحرك المطالبات
    key: 'insurance',
    items: [
      { to: '/insurance', label: 'health_insurance', icon: '🛡️', roles: null },
      { to: '/insurance-companies', label: 'insurance_companies', icon: '🏢', roles: ['admin', 'billing'] },
      { to: '/insurance-claims', label: 'insurance_claims', icon: '📋', roles: ['admin', 'billing'] },
    ],
  },
  {
    key: 'care',
    items: [
      { to: '/patients', label: 'patients', icon: '🧑‍🤝‍🧑', roles: ['admin', 'reception', 'doctor', 'nurse', 'billing'] },
      { to: '/appointments', label: 'appointments', icon: '📅', roles: ['admin', 'reception', 'doctor', 'nurse'] },
      { to: '/departments', label: 'departments', icon: '🏥', roles: ['admin', 'billing'] },
    ],
  },
  {
    key: 'resources',
    items: [
      { to: '/pharmacy', label: 'pharmacy', icon: '💊', roles: ['admin', 'pharmacy', 'doctor', 'nurse', 'billing'] },
      { to: '/warehouse', label: 'warehouse', icon: '📦', roles: ['admin', 'pharmacy', 'billing'] },
    ],
  },
  {
    // الشؤون المالية - قسم مستقل: كل ما يخص الحسابات والفوترة والرواتب والمحاسبة
    key: 'finance',
    items: [
      { to: '/billing', label: 'billing', icon: '💳', roles: ['admin', 'billing', 'reception'] },
      { to: '/installments', label: 'installments_platform', icon: '🏦', roles: ['admin', 'billing'] },
      { to: '/payroll', label: 'payroll', icon: '💰', roles: ['admin', 'billing'] },
      { to: '/chart-of-accounts', label: 'chart_of_accounts', icon: '🌳', roles: ['admin', 'billing'] },
      { to: '/journal-entries', label: 'journal_entries', icon: '📑', roles: ['admin', 'billing'] },
      { to: '/financial-statements', label: 'financial_statements', icon: '📈', roles: ['admin', 'billing'] },
      { to: '/staff-roster-financial', label: 'staff_roster_financial', icon: '📋', roles: ['admin', 'billing'] },
    ],
  },
  {
    // الشؤون الإدارية (الموارد البشرية) - قسم مستقل منفصل عن الشؤون المالية: حضور وكادر
    key: 'hr',
    items: [
      { to: '/attendance', label: 'attendance_management', icon: '🕒', roles: ['admin', 'billing'] },
      { to: '/staff-roster', label: 'staff_roster', icon: '📋', roles: ['admin', 'billing'] },
    ],
  },
  {
    // 4 صفحات مستقلة، كل واحدة بفئتها الوظيفية الخاصة بها فقط
    key: 'staff_categories',
    items: [
      { to: '/doctors', label: 'doctors', icon: '🩺', roles: ['admin'] },
      { to: '/dental-pharmacy-staff', label: 'dental_pharmacy_staff', icon: '🦷', roles: ['admin'] },
      { to: '/technicians', label: 'technicians_staff', icon: '🔬', roles: ['admin'] },
      { to: '/admin-general-staff', label: 'admin_general_staff', icon: '🗂️', roles: ['admin'] },
    ],
  },
  {
    key: 'administration',
    items: [
      { to: '/users', label: 'users', icon: '👥', roles: ['admin'] },
      { to: '/staff-approvals', label: 'staff_approvals', icon: '✅', roles: ['admin'], showForDeptHead: true },
      { to: '/audit-logs', label: 'audit_log', icon: '🛡️', roles: ['admin'] },
      { to: '/backups', label: 'backups', icon: '🗄️', roles: ['admin'] },
    ],
  },
];

// هل يحتوي هذا القسم الرئيسي على المسار الحالي (لفتحه تلقائيًا عند التنقل إليه)
function groupContainsPath(group, pathname) {
  const sections = group.sections || [{ items: group.items }];
  return sections.some((s) => s.items.some((item) => (
    item.to === pathname || (item.to !== '/' && pathname.startsWith(item.to))
  )));
}

export default function Layout({ children }) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // القائمة الجانبية بشكل درج: كل قسم رئيسي مطوي افتراضيًا، ويُفتح تلقائيًا القسم الذي يحتوي الصفحة الحالية
  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    NAV_GROUPS.forEach((g) => { initial[g.key] = groupContainsPath(g, location.pathname); });
    return initial;
  });

  useEffect(() => {
    const activeGroup = NAV_GROUPS.find((g) => groupContainsPath(g, location.pathname));
    if (activeGroup) {
      setOpenGroups((prev) => (prev[activeGroup.key] ? prev : { ...prev, [activeGroup.key]: true }));
    }
  }, [location.pathname]);

  function toggleGroup(key) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo-dot" />
          <div>
            <h1>{t('app_name')}</h1>
            <div className="brand-by">
              {t('by')} <span className="brand-name">Starlight</span>
            </div>
          </div>
        </div>
        <nav>
          {NAV_GROUPS.map((group) => {
            // كل فئة إما items مباشرة، أو sections فرعية (كل قسم بعنوانه الصغير الخاص)
            const sections = group.sections || [{ titleKey: null, items: group.items }];
            const visibleSections = sections
              .map((section) => ({
                ...section,
                items: section.items.filter((item) => (
                  !item.roles
                  || item.roles.includes(user?.role)
                  || (item.showForDeptHead && user?.is_department_head)
                )),
              }))
              .filter((section) => section.items.length > 0);
            if (visibleSections.length === 0) return null;

            const isOpen = !!openGroups[group.key];

            return (
              <div className="nav-group" key={group.key}>
                <button
                  type="button"
                  className={`nav-group-title nav-group-toggle${isOpen ? ' open' : ''}`}
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={isOpen}
                >
                  <span>{t(`nav_group_${group.key}`)}</span>
                  <span className="nav-group-chevron">▾</span>
                </button>
                {isOpen && (
                  <div className="nav-group-items">
                    {visibleSections.map((section, idx) => (
                      <div key={section.titleKey || idx} className={idx > 0 ? 'nav-subgroup' : undefined}>
                        {section.titleKey && <div className="nav-subgroup-title">{t(section.titleKey)}</div>}
                        {section.items.map((item) => (
                          <NavLink key={item.to} to={item.to} end={item.to === '/'}>
                            <span className="nav-icon">{item.icon}</span>
                            {t(item.label)}
                          </NavLink>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="main-content">
        <div className="topbar">
          <div>
            {t('welcome')}, {user?.full_name} ({user?.role})
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              className="secondary theme-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? t('light_mode') : t('dark_mode')}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <select
              value={i18n.language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{ width: 90, marginBottom: 0 }}
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
            <button className="secondary" onClick={handleLogout}>
              {t('logout')}
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

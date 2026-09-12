import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

// قائمة المستخدم المنسدلة أعلى كل صفحة: الاسم + الدور + أفاتار بحرف الاسم الأول،
// وبالضغط عليها تظهر خياري الإعدادات وتسجيل الخروج - تُغلق تلقائيًا عند الضغط خارجها
export default function UserMenu() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  function goToSettings() {
    setOpen(false);
    navigate('/settings');
  }

  function handleLogout() {
    setOpen(false);
    logout();
    navigate('/login');
  }

  const initial = (user?.full_name || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="user-menu-avatar">{initial}</span>
        <span className="user-menu-info">
          <span className="user-menu-name">{user?.full_name}</span>
          <span className="user-menu-role">{t(`role_${user?.role}`)}</span>
        </span>
        <span className="user-menu-chevron">▾</span>
      </button>

      {open && (
        <div className="user-menu-dropdown">
          <button type="button" className="user-menu-item" onClick={goToSettings}>
            <span>⚙️</span> {t('settings')}
          </button>
          <button type="button" className="user-menu-item danger" onClick={handleLogout}>
            <span>🚪</span> {t('logout')}
          </button>
        </div>
      )}
    </div>
  );
}

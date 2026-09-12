import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useSound } from '../context/SoundContext';
import { setLanguage } from '../i18n';

// صفحة الإعدادات الموحّدة: الوضع الليلي/الفاتح، المؤثرات الصوتية، ولغة الواجهة في مكان واحد
export default function Settings() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { muted, toggleMuted } = useSound();

  return (
    <div>
      <div className="topbar">
        <h2>{t('settings')}</h2>
      </div>

      <div className="card" style={{ maxWidth: 520 }}>
        <div className="settings-row">
          <div>
            <div className="settings-row-title">{t('dark_mode')} / {t('light_mode')}</div>
            <div className="settings-row-desc muted">
              {theme === 'dark' ? t('dark_mode') : t('light_mode')}
            </div>
          </div>
          <button type="button" className="secondary theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-title">{t('sound_on')} / {t('sound_off')}</div>
            <div className="settings-row-desc muted">
              {muted ? t('sound_off') : t('sound_on')}
            </div>
          </div>
          <button type="button" className="secondary theme-toggle sound-toggle" onClick={toggleMuted}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-title">{t('language')}</div>
            <div className="settings-row-desc muted">{i18n.language === 'ar' ? 'العربية' : 'English'}</div>
          </div>
          <select
            value={i18n.language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ width: 130, marginBottom: 0 }}
          >
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
    </div>
  );
}

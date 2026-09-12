import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSound } from '../context/SoundContext';
import { playSuccess, playError } from '../utils/sounds';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { muted, toggleMuted } = useSound();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      playSuccess();
      navigate('/');
    } catch (err) {
      playError();
      setError(t('invalid_credentials'));
    }
  }

  return (
    <div className="login-page">
      <div style={{ position: 'absolute', top: 20, insetInlineEnd: 20, display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="secondary theme-toggle sound-toggle login-theme-toggle"
          onClick={toggleMuted}
          title={muted ? t('sound_on') : t('sound_off')}
          style={{ position: 'static' }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button
          type="button"
          className="secondary theme-toggle login-theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? t('light_mode') : t('dark_mode')}
          style={{ position: 'static' }}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
      <form className="login-box" onSubmit={handleSubmit}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'var(--primary)',
              margin: '0 auto 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              boxShadow: '0 0 0 8px rgba(37,99,235,0.12)',
            }}
          >
            🏥
          </div>
          <h2 style={{ margin: 0 }}>{t('app_name')}</h2>
          <div className="brand-by" style={{ justifyContent: 'center', marginTop: 6 }}>
            {t('by')} <span className="brand-name">Starlight</span>
          </div>
        </div>
        {error && <div className="error-text">{error}</div>}
        <label>{t('username')}</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} required />
        <label>{t('password')}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" style={{ width: '100%' }}>
          {t('login')}
        </button>
      </form>
    </div>
  );
}

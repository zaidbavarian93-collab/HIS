import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function Backups() {
  const { t } = useTranslation();
  const [backups, setBackups] = useState([]);
  const [schedule, setSchedule] = useState('');
  const [retention, setRetention] = useState(0);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState(null);

  async function loadBackups() {
    const { data } = await api.get('/backup');
    setBackups(data.backups);
    setSchedule(data.schedule);
    setRetention(data.retention_count);
  }

  useEffect(() => { loadBackups(); }, []);

  async function runBackupNow() {
    setRunning(true);
    setMessage(null);
    try {
      const { data } = await api.post('/backup/run');
      setMessage({ type: 'success', text: `${t('backup_created')}: ${data.filename}` });
      loadBackups();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || t('backup_failed') });
    }
    setRunning(false);
  }

  async function downloadBackup(filename) {
    const res = await api.get(`/backup/${filename}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  async function removeBackup(filename) {
    await api.delete(`/backup/${filename}`);
    loadBackups();
  }

  const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

  return (
    <div>
      <div className="topbar">
        <h2>{t('backups')}</h2>
        <button onClick={runBackupNow} disabled={running}>
          {running ? t('backing_up') : `💾 ${t('run_backup_now')}`}
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">{t('total_backups')}</div>
          <div className="stat-value">{backups.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('total_size')}</div>
          <div className="stat-value">{formatSize(totalSize)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('auto_schedule')}</div>
          <div className="stat-value" style={{ fontSize: 16 }}>{schedule}</div>
        </div>
      </div>

      <div className="card muted" style={{ fontSize: 13 }}>
        {t('backup_info', { count: retention })}
      </div>

      {message && (
        <div className={message.type === 'error' ? 'error-text' : ''} style={{ fontWeight: 600, color: message.type === 'success' ? 'var(--success-text)' : undefined, marginBottom: 12 }}>
          {message.text}
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('file_name_col')}</th>
              <th>{t('created_at')}</th>
              <th>{t('size')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {backups.map((b) => (
              <tr key={b.filename}>
                <td>{b.filename}</td>
                <td>{new Date(b.created_at).toLocaleString('en-GB')}</td>
                <td>{formatSize(b.size)}</td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="secondary" onClick={() => downloadBackup(b.filename)}>⬇️ {t('download')}</button>
                  <button className="danger" onClick={() => removeBackup(b.filename)}>{t('delete')}</button>
                </td>
              </tr>
            ))}
            {backups.length === 0 && (
              <tr><td colSpan={4} className="muted">{t('no_backups_yet')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

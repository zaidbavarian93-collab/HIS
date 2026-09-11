const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const cron = require('node-cron');

const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');
// عدد النسخ الاحتياطية المُحتفَظ بها - الأقدم يُحذف تلقائيًا عند تجاوز هذا العدد
const RETENTION_COUNT = Number(process.env.BACKUP_RETENTION_COUNT || 14);
// جدول التشغيل التلقائي (صيغة cron) - افتراضيًا كل يوم الساعة 2:00 صباحًا
const BACKUP_CRON = process.env.BACKUP_CRON || '0 2 * * *';

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function timestampName() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

// ينفّذ pg_dump وينتج ملف SQL مضغوط، ثم يحذف النسخ الأقدم من حد الاحتفاظ
function runBackup() {
  return new Promise((resolve, reject) => {
    ensureBackupDir();
    const filename = `backup_${timestampName()}.sql`;
    const filePath = path.join(BACKUP_DIR, filename);
    const out = fs.createWriteStream(filePath);

    const child = spawn('pg_dump', [
      '-h', process.env.DB_HOST,
      '-p', process.env.DB_PORT || '5432',
      '-U', process.env.DB_USER,
      '-d', process.env.DB_NAME,
      '--no-owner',
      '--no-privileges',
    ], {
      env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD },
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.stdout.pipe(out);

    child.on('error', (err) => reject(err));

    child.on('close', (code) => {
      out.close();
      if (code !== 0) {
        fs.unlink(filePath, () => {});
        return reject(new Error(stderr || `pg_dump exited with code ${code}`));
      }
      cleanupOldBackups();
      resolve({ filename, path: filePath, size: fs.statSync(filePath).size });
    });
  });
}

function cleanupOldBackups() {
  const files = listBackups();
  if (files.length <= RETENTION_COUNT) return;
  files
    .slice(RETENTION_COUNT)
    .forEach((f) => {
      try {
        fs.unlinkSync(path.join(BACKUP_DIR, f.filename));
      } catch (err) {
        // تجاهل صامت إن تعذّر الحذف
      }
    });
}

// يُرجع قائمة النسخ الاحتياطية مرتبة من الأحدث إلى الأقدم
function listBackups() {
  ensureBackupDir();
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((filename) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, filename));
      return { filename, size: stat.size, created_at: stat.mtime };
    })
    .sort((a, b) => b.created_at - a.created_at);
}

function getBackupPath(filename) {
  // منع الخروج من مجلد النسخ الاحتياطي عبر أسماء ملفات ملغومة (path traversal)
  const safeName = path.basename(filename);
  const filePath = path.join(BACKUP_DIR, safeName);
  if (!fs.existsSync(filePath)) return null;
  return filePath;
}

function deleteBackup(filename) {
  const filePath = getBackupPath(filename);
  if (!filePath) return false;
  fs.unlinkSync(filePath);
  return true;
}

let scheduledTask = null;

// يفعّل الجدولة التلقائية عند إقلاع الخادم
function startScheduledBackups() {
  if (scheduledTask) return;
  ensureBackupDir();
  scheduledTask = cron.schedule(BACKUP_CRON, () => {
    runBackup().catch((err) => {
      console.error('فشل النسخ الاحتياطي التلقائي المجدوَل:', err.message);
    });
  });
  console.log(`تم تفعيل النسخ الاحتياطي التلقائي لقاعدة البيانات (الجدول: ${BACKUP_CRON})`);
}

module.exports = {
  runBackup,
  listBackups,
  getBackupPath,
  deleteBackup,
  startScheduledBackups,
  BACKUP_CRON,
  RETENTION_COUNT,
};

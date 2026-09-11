const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const backupService = require('../services/backup');

const router = express.Router();

// النسخ الاحتياطي وإدارته صلاحية admin فقط
router.use(authenticate, authorize('admin'));

// GET /api/backup - قائمة النسخ الاحتياطية المتوفرة + معلومات الجدولة
router.get('/', (req, res) => {
  const backups = backupService.listBackups();
  res.json({
    backups,
    schedule: backupService.BACKUP_CRON,
    retention_count: backupService.RETENTION_COUNT,
  });
});

// POST /api/backup/run - تشغيل نسخة احتياطية فورية يدويًا
router.post('/run', async (req, res) => {
  try {
    const result = await backupService.runBackup();
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: 'فشل إنشاء النسخة الاحتياطية', error: err.message });
  }
});

// GET /api/backup/:filename/download - تنزيل نسخة احتياطية معيّنة
router.get('/:filename/download', (req, res) => {
  const filePath = backupService.getBackupPath(req.params.filename);
  if (!filePath) return res.status(404).json({ message: 'النسخة الاحتياطية غير موجودة' });
  res.download(filePath);
});

// DELETE /api/backup/:filename - حذف نسخة احتياطية معيّنة
router.delete('/:filename', (req, res) => {
  const deleted = backupService.deleteBackup(req.params.filename);
  if (!deleted) return res.status(404).json({ message: 'النسخة الاحتياطية غير موجودة' });
  res.json({ message: 'تم حذف النسخة الاحتياطية' });
});

module.exports = router;

const express = require('express');
const { Notification } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { runNotificationCycle, REAL_GATEWAY_CONFIGURED } = require('../services/notifications');
const { logAudit } = require('../services/auditLog');

const router = express.Router();

router.use(authenticate, authorize('admin', 'billing', 'reception'));

// GET /api/notifications?type=&status=&channel= - سجل التنبيهات (تذكيرات مواعيد وتجديد تأمين)
router.get('/', async (req, res) => {
  const { notification_type, status, channel } = req.query;
  const where = {};
  if (notification_type) where.notification_type = notification_type;
  if (status) where.status = status;
  if (channel) where.channel = channel;

  const notifications = await Notification.findAll({ where, order: [['createdAt', 'DESC']], limit: 300 });
  res.json({ notifications, real_gateway_configured: REAL_GATEWAY_CONFIGURED });
});

// POST /api/notifications/run-cycle - تشغيل دورة التوليد والإرسال يدويًا (admin/billing) - نفس ما
// يُنفَّذ تلقائيًا يوميًا عبر cron، متاح هنا للتشغيل الفوري (اختبار/عرض تجريبي)
router.post('/run-cycle', authorize('admin', 'billing'), async (req, res) => {
  const result = await runNotificationCycle();
  await logAudit({
    req, action: 'create', entityType: 'Notification',
    description: `تشغيل دورة التنبيهات يدويًا: ${result.appointmentsCount} تذكير موعد، ${result.renewalsCount} تنبيه تجديد تأمين، ${result.dispatchedCount} أُرسل`,
    after: result,
  });
  res.json(result);
});

module.exports = router;

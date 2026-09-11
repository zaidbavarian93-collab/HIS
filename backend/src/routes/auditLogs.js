const express = require('express');
const { Op } = require('sequelize');
const { AuditLog } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// سجل التدقيق: admin فقط - يحتوي بيانات حساسة (رواتب، صلاحيات، قرارات) لا يجوز كشفها لغير المدير
router.use(authenticate, authorize('admin'));

// GET /api/audit-logs?action=&entity_type=&user_id=&from=&to=&search= - سجل مرشَّح مع صفحات
router.get('/', async (req, res) => {
  const { action, entity_type, user_id, from, to, search, page = 1, limit = 50 } = req.query;
  const where = {};
  if (action) where.action = action;
  if (entity_type) where.entity_type = entity_type;
  if (user_id) where.user_id = user_id;
  if (from && to) where.createdAt = { [Op.between]: [`${from}T00:00:00`, `${to}T23:59:59`] };
  if (search) where.description = { [Op.iLike]: `%${search}%` };

  const offset = (Number(page) - 1) * Number(limit);
  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: Number(limit),
    offset,
  });

  res.json({ rows, total: count, page: Number(page), pages: Math.ceil(count / Number(limit)) });
});

// GET /api/audit-logs/entity-types - قائمة أنواع الكيانات الموجودة فعليًا (لبناء فلتر ديناميكي)
router.get('/meta', async (req, res) => {
  const [entityTypes, actions] = await Promise.all([
    AuditLog.aggregate('entity_type', 'DISTINCT', { plain: false }),
    AuditLog.aggregate('action', 'DISTINCT', { plain: false }),
  ]);
  res.json({
    entity_types: entityTypes.map((r) => r.DISTINCT).sort(),
    actions: actions.map((r) => r.DISTINCT).sort(),
  });
});

module.exports = router;

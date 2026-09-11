const express = require('express');
const { Op } = require('sequelize');
const { Attendance, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { computeDayWageImpact } = require('../services/attendanceWage');
const { logAudit } = require('../services/auditLog');

const router = express.Router();

router.use(authenticate);

const HR_ROLES = ['admin', 'billing'];
const HOSPITAL_UTC_OFFSET_HOURS = 3; // توقيت بغداد - لتفادي احتساب اليوم/التأخير بتوقيت خادم مختلف (UTC)

function baghdadNow() {
  return new Date(Date.now() + HOSPITAL_UTC_OFFSET_HOURS * 3600000);
}

// تاريخ اليوم بتوقيت بغداد المحلي (وليس توقيت الخادم UTC) حتى لا يُسجَّل حضور منتصف الليل لليوم الخطأ
function todayStr() {
  return baghdadNow().toISOString().slice(0, 10);
}

// يحوّل شهرًا بصيغة YYYY-MM إلى نطاق تواريخ [أول يوم, آخر يوم] لأن عمود date من نوع DATE
// ولا يدعم مقارنة LIKE النصية مباشرة
function monthRange(month) {
  const [year, mon] = month.split('-').map(Number);
  const start = `${month}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, '0')}`;
  return { [Op.gte]: start, [Op.lte]: end };
}

// POST /api/attendance/check-in - تسجيل حضور ذاتي لليوم الحالي
router.post('/check-in', async (req, res) => {
  const date = todayStr();
  const existing = await Attendance.findOne({ where: { user_id: req.user.id, date } });
  if (existing && existing.check_in) {
    return res.status(409).json({ message: 'تم تسجيل الحضور مسبقًا اليوم' });
  }

  const now = new Date();
  // نتحقق من التأخير عبر نفس منطق قاعدة الأجر (8:30 بتوقيت بغداد + 30 دقيقة سماح) لضمان اتساق
  // حالة "متأخر" هنا مع الخصم الفعلي المحتسب لاحقًا في الرواتب
  const { impact } = computeDayWageImpact({ check_in: now, status: 'present', is_excused: false });
  const status = impact === 'full' ? 'present' : 'late';

  const record = existing
    ? await existing.update({ check_in: now, status })
    : await Attendance.create({ user_id: req.user.id, date, check_in: now, status });

  await logAudit({
    req, action: 'check_in', entityType: 'Attendance', entityId: record.id,
    description: `تسجيل حضور ذاتي: ${req.user.full_name} - ${date}${status === 'late' ? ' (متأخر)' : ''}`,
    after: { date, check_in: now, status },
  });

  res.status(201).json(record);
});

// POST /api/attendance/check-out - تسجيل انصراف ذاتي لليوم الحالي
router.post('/check-out', async (req, res) => {
  const date = todayStr();
  const existing = await Attendance.findOne({ where: { user_id: req.user.id, date } });
  if (!existing || !existing.check_in) {
    return res.status(400).json({ message: 'يجب تسجيل الحضور أولاً' });
  }
  if (existing.check_out) {
    return res.status(409).json({ message: 'تم تسجيل الانصراف مسبقًا اليوم' });
  }

  existing.check_out = new Date();
  await existing.save();

  await logAudit({
    req, action: 'check_out', entityType: 'Attendance', entityId: existing.id,
    description: `تسجيل انصراف ذاتي: ${req.user.full_name} - ${date}`,
    after: { date, check_out: existing.check_out },
  });

  res.json(existing);
});

// GET /api/attendance/me?month=YYYY-MM - سجل حضور المستخدم الحالي
router.get('/me', async (req, res) => {
  const { month } = req.query;
  const where = { user_id: req.user.id };
  if (month) where.date = monthRange(month);
  const records = await Attendance.findAll({ where, order: [['date', 'DESC']] });
  res.json(records);
});

// GET /api/attendance/today - حالة اليوم للمستخدم الحالي (لعرض زر حضور/انصراف)
router.get('/today', async (req, res) => {
  const record = await Attendance.findOne({ where: { user_id: req.user.id, date: todayStr() } });
  res.json(record);
});

// من هنا فصاعدًا: إدارة حضور كل الموظفين - admin و billing فقط (شؤون الموظفين/المحاسبة)
router.use(authorize(...HR_ROLES));

// GET /api/attendance?month=YYYY-MM&user_id= - سجل حضور كل الموظفين أو موظف معيّن
router.get('/', async (req, res) => {
  const { month, user_id } = req.query;
  const where = {};
  if (month) where.date = monthRange(month);
  if (user_id) where.user_id = user_id;
  const records = await Attendance.findAll({
    where,
    include: [{ model: User, attributes: ['id', 'full_name', 'role'] }],
    order: [['date', 'DESC']],
  });
  const withWageImpact = records.map((r) => ({ ...r.toJSON(), wage_impact: computeDayWageImpact(r) }));
  res.json(withWageImpact);
});

// POST /api/attendance - إضافة/تعديل سجل حضور يدويًا لأي موظف ويوم (upsert)، بما فيها إضافة/إلغاء عذر
router.post('/', async (req, res) => {
  const { user_id, date, status, check_in, check_out, notes, is_excused, excuse_reason } = req.body;
  if (!user_id || !date || !status) {
    return res.status(400).json({ message: 'الموظف والتاريخ والحالة مطلوبة' });
  }

  const [record, created] = await Attendance.findOrCreate({
    where: { user_id, date },
    defaults: { status, check_in: check_in || null, check_out: check_out || null, notes },
  });

  const before = created ? null : {
    status: record.status, check_in: record.check_in, check_out: record.check_out,
    is_excused: record.is_excused, excuse_reason: record.excuse_reason,
  };

  record.status = status;
  if (check_in !== undefined) record.check_in = check_in || null;
  if (check_out !== undefined) record.check_out = check_out || null;
  if (notes !== undefined) record.notes = notes;
  if (is_excused !== undefined) record.is_excused = is_excused;
  if (excuse_reason !== undefined) record.excuse_reason = excuse_reason;
  await record.save();

  const target = await User.findByPk(user_id, { attributes: ['full_name'] });
  await logAudit({
    req, action: created ? 'create' : 'update', entityType: 'Attendance', entityId: record.id,
    description: `${created ? 'إضافة سجل حضور جديد' : 'تعديل يدوي لسجل حضور'} ${target?.full_name || user_id} - ${date} (بواسطة ${req.user.full_name})`,
    before,
    after: { status: record.status, check_in: record.check_in, check_out: record.check_out, is_excused: record.is_excused, excuse_reason: record.excuse_reason },
  });

  res.status(201).json({ ...record.toJSON(), wage_impact: computeDayWageImpact(record) });
});

// DELETE /api/attendance/:id - حذف سجل حضور (admin فقط)
router.delete('/:id', authorize('admin'), async (req, res) => {
  const record = await Attendance.findByPk(req.params.id);
  if (record) {
    const target = await User.findByPk(record.user_id, { attributes: ['full_name'] });
    await logAudit({
      req, action: 'delete', entityType: 'Attendance', entityId: record.id,
      description: `حذف سجل حضور ${target?.full_name || record.user_id} - ${record.date}`,
      before: { date: record.date, status: record.status, check_in: record.check_in, check_out: record.check_out },
    });
  }
  await Attendance.destroy({ where: { id: req.params.id } });
  res.json({ message: 'تم حذف السجل' });
});

module.exports = router;

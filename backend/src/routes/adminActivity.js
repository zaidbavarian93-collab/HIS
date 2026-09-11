const express = require('express');
const { Op } = require('sequelize');
const { Attendance, User, Appointment, JournalEntryLine, JournalEntry, Account, Patient, Department } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { computeDayWageImpact } = require('../services/attendanceWage');
const { logAudit } = require('../services/auditLog');

const router = express.Router();

// نافذة نشاطات مدير النظام: حضور بالبصمة، زيارات المرضى، الواردات والنفقات - لمدير النظام والمحاسبة فقط
router.use(authenticate, authorize('admin', 'billing'));

async function financeSummary(from, to) {
  const accounts = await Account.findAll({ where: { is_group: false, type: ['revenue', 'expense'] } });
  const lines = await JournalEntryLine.findAll({
    attributes: [
      'account_id',
      [JournalEntryLine.sequelize.fn('SUM', JournalEntryLine.sequelize.col('debit')), 'total_debit'],
      [JournalEntryLine.sequelize.fn('SUM', JournalEntryLine.sequelize.col('credit')), 'total_credit'],
    ],
    include: [{ model: JournalEntry, attributes: [], where: { entry_date: { [Op.between]: [from, to] } } }],
    group: ['account_id'],
    raw: true,
  });
  const byAccount = {};
  lines.forEach((l) => { byAccount[l.account_id] = { debit: Number(l.total_debit), credit: Number(l.total_credit) }; });

  let totalRevenue = 0;
  let totalExpense = 0;
  accounts.forEach((a) => {
    const l = byAccount[a.id] || { debit: 0, credit: 0 };
    if (a.type === 'revenue') totalRevenue += l.credit - l.debit;
    else totalExpense += l.debit - l.credit;
  });
  return { total_revenue: totalRevenue, total_expense: totalExpense, net: totalRevenue - totalExpense };
}

// GET /api/admin-activity/summary?from=&to= - ملخص شامل: الحضور بالبصمة، الزيارات، الواردات والنفقات
router.get('/summary', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ message: 'يجب تحديد الفترة (from, to)' });

  const [attendanceRecords, activeStaffCount, visitsCount, finance] = await Promise.all([
    Attendance.findAll({ where: { date: { [Op.between]: [from, to] } }, include: [{ model: User, attributes: ['id', 'full_name', 'role'] }] }),
    User.count({ where: { is_active: true } }),
    Appointment.count({ where: { scheduled_at: { [Op.between]: [`${from}T00:00:00`, `${to}T23:59:59`] } } }),
    financeSummary(from, to),
  ]);

  let fullDays = 0;
  let halfDays = 0;
  let zeroDays = 0;
  let excusedDays = 0;
  let lateArrivals = 0;
  attendanceRecords.forEach((r) => {
    const { impact, lateMinutes } = computeDayWageImpact(r);
    if (r.is_excused) excusedDays += 1;
    else if (impact === 'half') halfDays += 1;
    else if (impact === 'none') zeroDays += 1;
    else fullDays += 1;
    if (lateMinutes && lateMinutes > 0) lateArrivals += 1;
  });

  res.json({
    from,
    to,
    attendance: {
      active_staff_count: activeStaffCount,
      records_count: attendanceRecords.length,
      on_time_or_full_wage: fullDays,
      half_wage_deduction: halfDays,
      zero_wage: zeroDays,
      excused: excusedDays,
      late_arrivals: lateArrivals,
    },
    visits: visitsCount,
    finance,
  });
});

// GET /api/admin-activity/attendance-detail?date=YYYY-MM-DD - حضور وانصراف كل الكوادر ليوم واحد
// (أساس ملف Excel اليومي المطلوب) - إن أُرسلت from/to بدل date يُعرض نطاق كامل بدل يوم واحد
router.get('/attendance-detail', async (req, res) => {
  const { date, from, to } = req.query;
  const where = {};
  if (date) where.date = date;
  else if (from && to) where.date = { [Op.between]: [from, to] };
  else return res.status(400).json({ message: 'يجب تحديد date أو from/to' });

  const records = await Attendance.findAll({
    where,
    include: [{ model: User, attributes: ['id', 'full_name', 'role', 'job_grade'] }],
    order: [['date', 'DESC'], [{ model: User }, 'full_name', 'ASC']],
  });

  const detailed = records.map((r) => ({ ...r.toJSON(), wage_impact: computeDayWageImpact(r) }));
  res.json(detailed);
});

// GET /api/admin-activity/visits?from=&to= - قائمة المراجعين (المرضى): اسم المريض، القسم، نوع
// الاستشارة (نوع القسم)، والطبيب الذي راجعوه - أساس فقرة "المراجعون" في نافذة النشاطات
router.get('/visits', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ message: 'يجب تحديد الفترة (from, to)' });

  const appointments = await Appointment.findAll({
    where: { scheduled_at: { [Op.between]: [`${from}T00:00:00`, `${to}T23:59:59`] } },
    include: [
      { model: Patient, attributes: ['id', 'full_name', 'file_number', 'phone'] },
      { model: User, as: 'doctor', attributes: ['id', 'full_name'] },
      { model: Department, attributes: ['id', 'name_ar', 'name_en', 'type'] },
    ],
    order: [['scheduled_at', 'DESC']],
  });

  const visits = appointments.map((a) => ({
    id: a.id,
    scheduled_at: a.scheduled_at,
    status: a.status,
    patient_name: a.Patient?.full_name,
    file_number: a.Patient?.file_number,
    department_name: a.Department?.name_ar,
    consultation_type: a.Department?.type,
    doctor_name: a.doctor?.full_name,
  }));

  res.json(visits);
});

// PUT /api/admin-activity/attendance/:id/excuse - تسجيل عذر مقبول (يُلغي خصم الأجر لهذا اليوم)
router.put('/attendance/:id/excuse', async (req, res) => {
  const record = await Attendance.findByPk(req.params.id);
  if (!record) return res.status(404).json({ message: 'السجل غير موجود' });

  const before = { is_excused: record.is_excused, excuse_reason: record.excuse_reason };
  const newIsExcused = req.body.is_excused !== undefined ? req.body.is_excused : true;
  record.is_excused = newIsExcused;
  record.excuse_reason = req.body.excuse_reason || null;
  await record.save();

  const target = await User.findByPk(record.user_id, { attributes: ['full_name'] });
  await logAudit({
    req, action: 'update', entityType: 'Attendance', entityId: record.id,
    description: `${newIsExcused ? 'منح' : 'إلغاء'} عذر عن غياب/تأخير ${target?.full_name || record.user_id} - ${record.date}${req.body.excuse_reason ? ` - السبب: ${req.body.excuse_reason}` : ''} (يُلغي خصم الأجر عن هذا اليوم)`,
    before, after: { is_excused: record.is_excused, excuse_reason: record.excuse_reason },
  });

  res.json({ ...record.toJSON(), wage_impact: computeDayWageImpact(record) });
});

module.exports = router;

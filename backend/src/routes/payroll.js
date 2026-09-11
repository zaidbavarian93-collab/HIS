const express = require('express');
const { Op } = require('sequelize');
const { Payroll, User, Attendance, SystemSetting } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { DEFAULT_PAYROLL_DEDUCTIONS, PAYROLL_DEDUCTIONS_KEY } = require('./settings');
const { postJournalEntry, ACCOUNT_CODES } = require('../services/accounting');
const { computeMonthlyAttendanceDeduction } = require('../services/attendanceWage');
const { logAudit } = require('../services/auditLog');

const router = express.Router();

router.use(authenticate, authorize('admin', 'billing'));

function computeNet(base, allowances, deductions, socialSecurity, incomeTax) {
  return (
    Number(base) + Number(allowances) - Number(deductions) - Number(socialSecurity) - Number(incomeTax)
  );
}

// يحوّل شهرًا بصيغة YYYY-MM إلى نطاق تواريخ لأن عمود date من نوع DATE (لا يدعم LIKE النصي)
function monthRange(month) {
  const [year, mon] = month.split('-').map(Number);
  const start = `${month}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, '0')}`;
  return { [Op.gte]: start, [Op.lte]: end };
}

// يحسب ضريبة الدخل التصاعدية على الجزء الخاضع للضريبة (بعد خصم الشريحة المعفاة) حسب الشرائح المُعدّة
function calculateProgressiveTax(taxableAmount, brackets) {
  let remaining = taxableAmount;
  let tax = 0;
  let lowerBound = 0;

  for (const bracket of brackets) {
    if (remaining <= 0) break;
    const bracketSize = bracket.upTo === null ? remaining : Math.max(0, bracket.upTo - lowerBound);
    const amountInBracket = Math.min(remaining, bracketSize);
    tax += amountInBracket * bracket.rate;
    remaining -= amountInBracket;
    lowerBound = bracket.upTo;
  }

  return Math.round(tax * 100) / 100;
}

async function getDeductionSettings() {
  const setting = await SystemSetting.findByPk(PAYROLL_DEDUCTIONS_KEY);
  return setting ? setting.value : DEFAULT_PAYROLL_DEDUCTIONS;
}

function computeStatutoryDeductions(baseSalary, settings) {
  const socialSecurity = Math.round(Number(baseSalary) * settings.social_security_rate * 100) / 100;
  const taxable = Math.max(0, Number(baseSalary) - settings.tax_exempt_monthly);
  const incomeTax = calculateProgressiveTax(taxable, settings.tax_brackets);
  return { socialSecurity, incomeTax };
}

// GET /api/payroll?month=YYYY-MM - كشوف رواتب شهر معيّن
router.get('/', async (req, res) => {
  const { month } = req.query;
  const where = month ? { month } : {};
  const payrolls = await Payroll.findAll({
    where,
    include: [{ model: User, attributes: ['id', 'full_name', 'username', 'role'] }],
    order: [['created_at', 'DESC']],
  });
  res.json(payrolls);
});

// POST /api/payroll/generate - توليد كشوف رواتب لشهر معيّن لكل الموظفين الفعّالين (دون تكرار)
// يستخرج ملخّص الحضور تلقائيًا ويحسب استقطاع الغياب، إضافة لاستقطاعي الضمان الاجتماعي وضريبة الدخل
// النظاميين حسب إعدادات النظام (settings/payroll-deductions)
router.post('/generate', async (req, res) => {
  const { month } = req.body;
  if (!month) return res.status(400).json({ message: 'الشهر مطلوب (YYYY-MM)' });

  const employees = await User.findAll({ where: { is_active: true } });
  const existing = await Payroll.findAll({ where: { month } });
  const existingByUserId = new Map(existing.map((p) => [p.user_id, p]));
  const employeesToProcess = employees.filter((emp) => !existingByUserId.has(emp.id));

  const deductionSettings = await getDeductionSettings();

  // سجلات الحضور الفعلية (بأوقات البصمة) لكل موظفي الشهر - أساس حساب الخصم حسب قاعدة 8:30
  const attendanceRecords = await Attendance.findAll({ where: { date: monthRange(month) } });
  const attendanceByUser = {};
  const attendanceRecordsByUser = {};
  attendanceRecords.forEach((rec) => {
    if (!attendanceByUser[rec.user_id]) attendanceByUser[rec.user_id] = { present: 0, late: 0, absent: 0, leave: 0 };
    attendanceByUser[rec.user_id][rec.status] += 1;
    if (!attendanceRecordsByUser[rec.user_id]) attendanceRecordsByUser[rec.user_id] = [];
    attendanceRecordsByUser[rec.user_id].push(rec);
  });

  // مزامنة الراتب الأساسي: إن عُدِّل راتب موظف من ملفه الشخصي بعد توليد كشفه لهذا الشهر (وما زال
  // "قيد الانتظار" لم يُصرف بعد)، يُحدَّث الكشف تلقائيًا هنا ليعكس الراتب الجديد بدل أن يبقى عالقًا
  // بالقيمة القديمة - وهذا سبب عدم ظهور تعديل الراتب في الحسابات سابقًا (كان يُلتقط فقط عند أول توليد)
  const syncUpdates = [];
  employees.forEach((emp) => {
    const record = existingByUserId.get(emp.id);
    if (!record || record.status === 'paid') return;
    if (Number(record.base_salary) === Number(emp.base_salary)) return;

    const dailyRate = Number(emp.base_salary) / 30;
    const { deduction: attendanceDeduction } = computeMonthlyAttendanceDeduction(attendanceRecordsByUser[emp.id] || [], dailyRate);
    const { socialSecurity, incomeTax } = computeStatutoryDeductions(emp.base_salary, deductionSettings);

    record.base_salary = emp.base_salary;
    record.deductions = attendanceDeduction;
    record.attendance_deduction = attendanceDeduction;
    record.social_security_deduction = socialSecurity;
    record.income_tax_deduction = incomeTax;
    record.net_salary = computeNet(emp.base_salary, record.allowances, attendanceDeduction, socialSecurity, incomeTax);
    syncUpdates.push(record);
  });
  if (syncUpdates.length > 0) {
    await Promise.all(syncUpdates.map((r) => r.save()));
  }

  const toCreate = employeesToProcess.map((emp) => {
    const summary = attendanceByUser[emp.id] || { present: 0, late: 0, absent: 0, leave: 0 };
    const dailyRate = Number(emp.base_salary) / 30;
    const wageCalc = computeMonthlyAttendanceDeduction(attendanceRecordsByUser[emp.id] || [], dailyRate);
    const attendanceDeduction = wageCalc.deduction;
    const { socialSecurity, incomeTax } = computeStatutoryDeductions(emp.base_salary, deductionSettings);

    const notesParts = [];
    if (wageCalc.halfDays > 0) notesParts.push(`خصم نصف الأجر (تأخير 30-120 دقيقة): ${wageCalc.halfDays} يوم`);
    if (wageCalc.zeroDays > 0) notesParts.push(`بلا أجر (غياب أو تأخير أكثر من ساعتين): ${wageCalc.zeroDays} يوم`);
    if (wageCalc.excusedDays > 0) notesParts.push(`أيام معفاة بعذر: ${wageCalc.excusedDays}`);
    notesParts.push(`ضمان اجتماعي: ${socialSecurity} | ضريبة دخل: ${incomeTax}`);

    return {
      user_id: emp.id,
      month,
      base_salary: emp.base_salary,
      allowances: 0,
      deductions: attendanceDeduction,
      social_security_deduction: socialSecurity,
      income_tax_deduction: incomeTax,
      net_salary: computeNet(emp.base_salary, 0, attendanceDeduction, socialSecurity, incomeTax),
      present_days: summary.present,
      absent_days: summary.absent,
      late_days: summary.late,
      leave_days: summary.leave,
      attendance_deduction: attendanceDeduction,
      status: 'pending',
      notes: notesParts.join(' — '),
      created_by: req.user.id,
    };
  });

  if (toCreate.length > 0) {
    await Payroll.bulkCreate(toCreate);
  }

  const payrolls = await Payroll.findAll({
    where: { month },
    include: [{ model: User, attributes: ['id', 'full_name', 'username', 'role'] }],
    order: [['created_at', 'DESC']],
  });
  res.status(201).json({ created: toCreate.length, synced: syncUpdates.length, payrolls });
});

// PUT /api/payroll/:id - تعديل البدلات/الاستقطاعات (فقط للكشوف غير المدفوعة)
router.put('/:id', async (req, res) => {
  const payroll = await Payroll.findByPk(req.params.id);
  if (!payroll) return res.status(404).json({ message: 'كشف الراتب غير موجود' });
  if (payroll.status === 'paid') {
    return res.status(400).json({ message: 'لا يمكن تعديل كشف تم صرفه بالفعل' });
  }

  const { allowances, deductions, social_security_deduction, income_tax_deduction, notes } = req.body;
  if (allowances !== undefined) payroll.allowances = allowances;
  if (deductions !== undefined) payroll.deductions = deductions;
  if (social_security_deduction !== undefined) payroll.social_security_deduction = social_security_deduction;
  if (income_tax_deduction !== undefined) payroll.income_tax_deduction = income_tax_deduction;
  if (notes !== undefined) payroll.notes = notes;
  payroll.net_salary = computeNet(
    payroll.base_salary,
    payroll.allowances,
    payroll.deductions,
    payroll.social_security_deduction,
    payroll.income_tax_deduction
  );

  await payroll.save();
  res.json(payroll);
});

// PUT /api/payroll/:id/pay - صرف الراتب (تعليم كمدفوع)
router.put('/:id/pay', async (req, res) => {
  const payroll = await Payroll.findByPk(req.params.id);
  if (!payroll) return res.status(404).json({ message: 'كشف الراتب غير موجود' });
  if (payroll.status === 'paid') {
    return res.status(400).json({ message: 'تم صرف هذا الراتب مسبقًا' });
  }

  payroll.status = 'paid';
  payroll.paid_at = new Date();
  await payroll.save();

  // قيد يومية تلقائي: مصروف الرواتب يوزَّع بين النقدية المدفوعة والاستقطاعات النظامية المستحقة للجهات الرسمية
  const grossExpense = Number(payroll.base_salary) + Number(payroll.allowances) - Number(payroll.deductions);
  try {
    await postJournalEntry({
      description: `صرف راتب ${payroll.month}`,
      referenceType: 'payroll',
      referenceId: payroll.id,
      userId: req.user.id,
      lines: [
        { code: ACCOUNT_CODES.SALARIES_EXPENSE, debit: grossExpense, credit: 0 },
        { code: ACCOUNT_CODES.CASH, debit: 0, credit: Number(payroll.net_salary) },
        { code: ACCOUNT_CODES.SOCIAL_SECURITY_PAYABLE, debit: 0, credit: Number(payroll.social_security_deduction) },
        { code: ACCOUNT_CODES.INCOME_TAX_PAYABLE, debit: 0, credit: Number(payroll.income_tax_deduction) },
      ],
    });
  } catch (err) {
    console.error('تعذّر ترحيل قيد الراتب:', err.message);
  }

  const payee = await User.findByPk(payroll.user_id, { attributes: ['full_name'] });
  await logAudit({
    req, action: 'pay', entityType: 'Payroll', entityId: payroll.id,
    description: `صرف راتب ${payroll.month} لـ ${payee?.full_name || payroll.user_id} - صافي ${Number(payroll.net_salary).toLocaleString('en-US')}`,
    after: { net_salary: payroll.net_salary, base_salary: payroll.base_salary, month: payroll.month },
  });

  res.json(payroll);
});

// DELETE /api/payroll/:id - حذف كشف راتب (قبل الصرف فقط، admin فقط)
router.delete('/:id', authorize('admin'), async (req, res) => {
  const payroll = await Payroll.findByPk(req.params.id);
  if (!payroll) return res.status(404).json({ message: 'كشف الراتب غير موجود' });
  if (payroll.status === 'paid') {
    return res.status(400).json({ message: 'لا يمكن حذف كشف تم صرفه' });
  }
  const payee = await User.findByPk(payroll.user_id, { attributes: ['full_name'] });
  await logAudit({
    req, action: 'delete', entityType: 'Payroll', entityId: payroll.id,
    description: `حذف كشف راتب ${payroll.month} لـ ${payee?.full_name || payroll.user_id}`,
    before: { base_salary: payroll.base_salary, net_salary: payroll.net_salary, month: payroll.month },
  });
  await payroll.destroy();
  res.json({ message: 'تم حذف كشف الراتب' });
});

module.exports = router;

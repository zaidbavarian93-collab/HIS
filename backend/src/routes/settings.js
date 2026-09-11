const express = require('express');
const { SystemSetting } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../services/auditLog');

const router = express.Router();

router.use(authenticate, authorize('admin', 'billing'));

const PAYROLL_DEDUCTIONS_KEY = 'payroll_deductions';

// القيم الافتراضية أدناه مبنية على قانون الضمان الاجتماعي رقم 18 لسنة 2023 (وقانون 39/1971 سابقًا)
// وقانون ضريبة الدخل رقم 113 لسنة 1982 المعدّل (شرائح الاستقطاع المباشر الشهرية)، بحسب مصادر عامة
// تم التحقق منها في 2026-09. **يجب مراجعتها وتحديثها من قبل محاسب مختص أو مباشرةً من الهيئة العامة
// للضرائب (tax.mof.gov.iq) ودائرة التقاعد والضمان الاجتماعي قبل الاعتماد عليها فعليًا في الصرف**،
// فالنسب والإعفاءات تختلف حسب طبيعة المنشأة (حكومية/خاصة) والحالة الاجتماعية وقد تتغيّر بقرارات لاحقة.
const DEFAULT_PAYROLL_DEDUCTIONS = {
  // 5% للقطاع الخاص (قانون 18/2023 و39/1971) - أما موظفو الدولة فنسبتهم 10% حسب قانون التقاعد
  // الموحد رقم 9 لسنة 2014 (+15% إضافية تتحملها الخزينة العامة، لا تُخصم من الموظف)
  social_security_rate: 0.05,
  // الإعفاء الشهري من ضريبة الدخل للموظف الأعزب في القطاع الخاص - قد يختلف للمتزوجين/المعيلين
  tax_exempt_monthly: 208333,
  tax_brackets: [
    // شرائح الاستقطاع المباشر الشهري من ضريبة الدخل (تُطبَّق على الراتب الخاضع بعد خصم الإعفاء أعلاه)
    { upTo: 20833, rate: 0.03 },
    { upTo: 41667, rate: 0.05 },
    { upTo: 83333, rate: 0.10 },
    { upTo: null, rate: 0.15 }, // null = بلا حد أعلى (كل ما تبقى)
  ],
};

// GET /api/settings/payroll-deductions - إعدادات استقطاعات الرواتب الحالية
router.get('/payroll-deductions', async (req, res) => {
  const setting = await SystemSetting.findByPk(PAYROLL_DEDUCTIONS_KEY);
  res.json(setting ? setting.value : DEFAULT_PAYROLL_DEDUCTIONS);
});

// PUT /api/settings/payroll-deductions - تعديل نسب/شرائح الاستقطاعات (admin فقط)
router.put('/payroll-deductions', authorize('admin'), async (req, res) => {
  const { social_security_rate, tax_exempt_monthly, tax_brackets } = req.body;
  if (
    typeof social_security_rate !== 'number' ||
    typeof tax_exempt_monthly !== 'number' ||
    !Array.isArray(tax_brackets)
  ) {
    return res.status(400).json({ message: 'صيغة بيانات الإعدادات غير صحيحة' });
  }

  const before = await SystemSetting.findByPk(PAYROLL_DEDUCTIONS_KEY);
  const value = { social_security_rate, tax_exempt_monthly, tax_brackets };
  await SystemSetting.upsert({ key: PAYROLL_DEDUCTIONS_KEY, value });
  await logAudit({
    req, action: 'update', entityType: 'SystemSetting', entityId: PAYROLL_DEDUCTIONS_KEY,
    description: 'تعديل اللائحة المالية (نسب استقطاعات الرواتب) - يؤثر على كل الرواتب المستقبلية',
    before: before?.value || null, after: value,
  });
  res.json(value);
});

module.exports = router;
module.exports.DEFAULT_PAYROLL_DEDUCTIONS = DEFAULT_PAYROLL_DEDUCTIONS;
module.exports.PAYROLL_DEDUCTIONS_KEY = PAYROLL_DEDUCTIONS_KEY;

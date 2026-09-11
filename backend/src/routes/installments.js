const express = require('express');
const { Op } = require('sequelize');
const { InstallmentPlan, InstallmentPayment, Invoice, Patient, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { postJournalEntry, ACCOUNT_CODES } = require('../services/accounting');
const { logAudit } = require('../services/auditLog');

const router = express.Router();

router.use(authenticate, authorize('admin', 'billing'));

// الحد الأدنى لقيمة العملية المؤهَّلة للتقسيط - "العمليات الكبرى" وفق طلب الإدارة
const MIN_INSTALLMENT_AMOUNT = 1000000;

async function generatePlanNumber() {
  const year = new Date().getFullYear();
  const count = await InstallmentPlan.count();
  return `INST-${year}-${String(count + 1).padStart(6, '0')}`;
}

function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

const PLAN_INCLUDE = [
  { model: Invoice, attributes: ['id', 'invoice_number', 'total_amount', 'insurance_covered_amount'] },
  { model: Patient, attributes: ['id', 'full_name', 'file_number', 'phone'] },
  { model: InstallmentPayment, as: 'payments', order: [['installment_number', 'ASC']] },
];

// GET /api/installments/eligible-invoices - فواتير عمليات كبرى (>= 1,000,000) غير مسدَّدة ولا تقسيط لها
router.get('/eligible-invoices', async (req, res) => {
  const invoices = await Invoice.findAll({
    where: { status: 'unpaid', total_amount: { [Op.gte]: MIN_INSTALLMENT_AMOUNT } },
    include: [{ model: Patient, attributes: ['id', 'full_name', 'file_number', 'phone'] }],
    order: [['createdAt', 'DESC']],
  });
  res.json(invoices);
});

// GET /api/installments?status= - كل خطط الأقساط
router.get('/', async (req, res) => {
  const { status } = req.query;
  const where = {};
  if (status) where.status = status;

  const plans = await InstallmentPlan.findAll({ where, include: PLAN_INCLUDE, order: [['createdAt', 'DESC']] });

  // نحدّث حالة "متأخرة" لحظيًا عند العرض دون تخزين وظيفة مجدولة إضافية - أي دفعة pending تجاوزت
  // موعد استحقاقها تُعرض overdue فورًا (يُحفَظ التحديث في القاعدة أيضًا ليبقى متسقًا لاحقًا)
  const today = new Date().toISOString().slice(0, 10);
  const overdueUpdates = [];
  plans.forEach((plan) => {
    plan.payments.forEach((p) => {
      if (p.status === 'pending' && p.due_date < today) {
        p.status = 'overdue';
        overdueUpdates.push(p.save());
      }
    });
  });
  if (overdueUpdates.length > 0) await Promise.all(overdueUpdates);

  res.json(plans);
});

// GET /api/installments/:id - تفصيل خطة واحدة
router.get('/:id', async (req, res) => {
  const plan = await InstallmentPlan.findByPk(req.params.id, { include: PLAN_INCLUDE });
  if (!plan) return res.status(404).json({ message: 'الخطة غير موجودة' });
  res.json(plan);
});

// POST /api/installments - إنشاء خطة أقساط جديدة لفاتورة عملية كبرى
router.post('/', async (req, res) => {
  const { invoice_id, installments_count, down_payment, start_date, notes } = req.body;

  if (!invoice_id || !installments_count || installments_count < 1) {
    return res.status(400).json({ message: 'الفاتورة وعدد الأقساط (1 فأكثر) مطلوبة' });
  }

  const invoice = await Invoice.findByPk(invoice_id, { include: [{ model: Patient, attributes: ['id', 'full_name'] }] });
  if (!invoice) return res.status(404).json({ message: 'الفاتورة غير موجودة' });
  if (invoice.status !== 'unpaid') {
    return res.status(400).json({ message: 'لا يمكن إنشاء خطة أقساط إلا لفاتورة غير مسدَّدة' });
  }
  if (Number(invoice.total_amount) < MIN_INSTALLMENT_AMOUNT) {
    return res.status(400).json({ message: `نظام الأقساط متاح فقط للعمليات الكبرى (${MIN_INSTALLMENT_AMOUNT.toLocaleString('en-US')} د.ع فأكثر)` });
  }

  const patientPortion = Number(invoice.total_amount) - Number(invoice.insurance_covered_amount);
  const downPaymentAmount = Number(down_payment) || 0;
  if (downPaymentAmount < 0 || downPaymentAmount >= patientPortion) {
    return res.status(400).json({ message: 'الدفعة الأولى غير صالحة - يجب أن تكون أقل من المبلغ المستحق على المريض' });
  }

  const remaining = patientPortion - downPaymentAmount;
  const baseInstallment = Math.floor((remaining / installments_count) * 100) / 100;
  const lastInstallment = Math.round((remaining - baseInstallment * (installments_count - 1)) * 100) / 100;

  const planStartDate = start_date || new Date().toISOString().slice(0, 10);

  try {
    const plan = await InstallmentPlan.create({
      plan_number: await generatePlanNumber(),
      invoice_id: invoice.id,
      patient_id: invoice.patient_id,
      total_amount: patientPortion,
      down_payment: downPaymentAmount,
      installments_count,
      installment_amount: baseInstallment,
      status: 'active',
      start_date: planStartDate,
      notes,
      created_by: req.user.id,
    });

    const paymentsToCreate = [];
    if (downPaymentAmount > 0) {
      paymentsToCreate.push({
        installment_plan_id: plan.id, installment_number: 0, due_date: planStartDate,
        amount: downPaymentAmount, status: 'paid', paid_at: new Date(), paid_by: req.user.id,
      });
    }
    for (let i = 1; i <= installments_count; i += 1) {
      paymentsToCreate.push({
        installment_plan_id: plan.id,
        installment_number: i,
        due_date: addMonths(planStartDate, i),
        amount: i === installments_count ? lastInstallment : baseInstallment,
        status: 'pending',
      });
    }
    await InstallmentPayment.bulkCreate(paymentsToCreate);

    invoice.status = 'installment';
    await invoice.save();

    // قيد الدفعة الأولى إن وُجدت (تُحصَّل فورًا عند إنشاء الخطة)
    if (downPaymentAmount > 0) {
      try {
        await postJournalEntry({
          description: `دفعة أولى - خطة أقساط ${plan.plan_number}`,
          referenceType: 'invoice', referenceId: invoice.id, userId: req.user.id,
          lines: [
            { code: ACCOUNT_CODES.CASH, debit: downPaymentAmount, credit: 0 },
            { code: ACCOUNT_CODES.PATIENT_RECEIVABLE, debit: 0, credit: downPaymentAmount },
          ],
        });
      } catch (err) {
        console.error('تعذّر ترحيل قيد الدفعة الأولى:', err.message);
      }
    }

    await logAudit({
      req, action: 'create', entityType: 'InstallmentPlan', entityId: plan.id,
      description: `إنشاء خطة أقساط ${plan.plan_number} لـ ${invoice.Patient?.full_name} - فاتورة ${invoice.invoice_number} (${patientPortion.toLocaleString('en-US')} على ${installments_count} قسطًا)`,
      after: { total_amount: patientPortion, down_payment: downPaymentAmount, installments_count },
    });

    const full = await InstallmentPlan.findByPk(plan.id, { include: PLAN_INCLUDE });
    res.status(201).json(full);
  } catch (err) {
    res.status(400).json({ message: err.message || 'تعذّر إنشاء خطة الأقساط' });
  }
});

// PUT /api/installments/payments/:id/pay - تحصيل قسط واحد
router.put('/payments/:id/pay', async (req, res) => {
  const payment = await InstallmentPayment.findByPk(req.params.id, {
    include: [{ model: InstallmentPlan, as: 'plan', include: [{ model: Invoice }, { model: Patient, attributes: ['full_name'] }] }],
  });
  if (!payment) return res.status(404).json({ message: 'القسط غير موجود' });
  if (payment.status === 'paid') return res.status(400).json({ message: 'تم تحصيل هذا القسط مسبقًا' });

  payment.status = 'paid';
  payment.paid_at = new Date();
  payment.paid_by = req.user.id;
  await payment.save();

  try {
    await postJournalEntry({
      description: `تحصيل قسط رقم ${payment.installment_number} - خطة ${payment.plan.plan_number}`,
      referenceType: 'invoice', referenceId: payment.plan.invoice_id, userId: req.user.id,
      lines: [
        { code: ACCOUNT_CODES.CASH, debit: Number(payment.amount), credit: 0 },
        { code: ACCOUNT_CODES.PATIENT_RECEIVABLE, debit: 0, credit: Number(payment.amount) },
      ],
    });
  } catch (err) {
    console.error('تعذّر ترحيل قيد تحصيل القسط:', err.message);
  }

  // إن اكتملت كل الأقساط، تُختم الخطة والفاتورة كمسدَّدتين بالكامل
  const allPayments = await InstallmentPayment.findAll({ where: { installment_plan_id: payment.installment_plan_id } });
  const allPaid = allPayments.every((p) => p.status === 'paid');
  if (allPaid) {
    await InstallmentPlan.update({ status: 'completed' }, { where: { id: payment.installment_plan_id } });
    await Invoice.update({ status: 'paid', paid_at: new Date() }, { where: { id: payment.plan.invoice_id } });
  }

  await logAudit({
    req, action: 'pay', entityType: 'InstallmentPayment', entityId: payment.id,
    description: `تحصيل قسط رقم ${payment.installment_number} من ${payment.plan.Patient?.full_name} - ${Number(payment.amount).toLocaleString('en-US')} (خطة ${payment.plan.plan_number})${allPaid ? ' - اكتملت الخطة بالكامل' : ''}`,
    after: { amount: payment.amount, plan_completed: allPaid },
  });

  const full = await InstallmentPlan.findByPk(payment.installment_plan_id, { include: PLAN_INCLUDE });
  res.json(full);
});

// PUT /api/installments/:id/cancel - إلغاء خطة أقساط (admin فقط) - تعيد الفاتورة لحالة "غير مسدَّدة"
router.put('/:id/cancel', authorize('admin'), async (req, res) => {
  const plan = await InstallmentPlan.findByPk(req.params.id);
  if (!plan) return res.status(404).json({ message: 'الخطة غير موجودة' });
  if (plan.status !== 'active') return res.status(400).json({ message: 'لا يمكن إلغاء خطة غير نشطة' });

  plan.status = 'cancelled';
  await plan.save();
  await Invoice.update({ status: 'unpaid' }, { where: { id: plan.invoice_id } });

  await logAudit({
    req, action: 'update', entityType: 'InstallmentPlan', entityId: plan.id,
    description: `إلغاء خطة أقساط ${plan.plan_number}`,
  });

  res.json({ message: 'تم إلغاء خطة الأقساط' });
});

module.exports = router;

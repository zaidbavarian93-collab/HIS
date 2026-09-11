const express = require('express');
const { body, validationResult } = require('express-validator');
const { Invoice, Patient, InsuranceMember, InsurancePlan, Claim } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { postJournalEntry, ACCOUNT_CODES } = require('../services/accounting');

async function generateClaimNumber() {
  const year = new Date().getFullYear();
  const count = await Claim.count();
  const serial = String(count + 1).padStart(6, '0');
  return `CLM-${year}-${serial}`;
}

const router = express.Router();

router.use(authenticate);

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const count = await Invoice.count();
  const serial = String(count + 1).padStart(6, '0');
  return `INV-${year}-${serial}`;
}

function calculateTotal(items) {
  return items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0);
}

// GET /api/invoices?status=unpaid - قائمة الفواتير
router.get('/', authorize('admin', 'billing', 'reception'), async (req, res) => {
  const { status } = req.query;
  const where = status ? { status } : {};
  const invoices = await Invoice.findAll({
    where,
    include: [
      { model: Patient, attributes: ['id', 'full_name', 'file_number'] },
      { model: InsuranceMember, as: 'insuranceMember', attributes: ['id', 'full_name', 'policy_number'] },
    ],
    order: [['created_at', 'DESC']],
  });
  res.json(invoices);
});

// POST /api/invoices - إنشاء فاتورة جديدة (يطبّق تغطية التأمين الصحي تلقائيًا إن حُدِّد عضو مؤمَّن)
router.post(
  '/',
  authorize('admin', 'billing', 'reception'),
  [
    body('patient_id').notEmpty().withMessage('المريض مطلوب'),
    body('items').isArray({ min: 1 }).withMessage('يجب إضافة بند واحد على الأقل'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { patient_id, items, insurance_member_id } = req.body;
    const invoice_number = await generateInvoiceNumber();
    const total_amount = calculateTotal(items);

    let insuranceCoveredAmount = 0;
    let member = null;

    if (insurance_member_id) {
      member = await InsuranceMember.findByPk(insurance_member_id, { include: [{ model: InsurancePlan, as: 'plan' }] });
      if (!member) return res.status(404).json({ message: 'العضو المؤمَّن غير موجود' });
      if (member.status !== 'active') {
        return res.status(400).json({ message: 'اشتراك التأمين غير فعّال (منتهٍ أو موقوف)' });
      }

      const coveragePercent = Number(member.coverage_percentage) / 100;
      let covered = Math.round(total_amount * coveragePercent * 100) / 100;

      if (member.annual_max_coverage !== null) {
        const remaining = Number(member.annual_max_coverage) - Number(member.used_amount_this_year);
        covered = Math.max(0, Math.min(covered, remaining));
      }

      insuranceCoveredAmount = covered;
    }

    const invoice = await Invoice.create({
      invoice_number,
      patient_id,
      items,
      total_amount,
      insurance_member_id: insurance_member_id || null,
      insurance_covered_amount: insuranceCoveredAmount,
      created_by: req.user.id,
    });

    if (member && insuranceCoveredAmount > 0) {
      member.used_amount_this_year = Number(member.used_amount_this_year) + insuranceCoveredAmount;
      await member.save();
    }

    // إن كان العضو مؤمَّنًا عبر شركة تأمين خارجية متعاقدة (لا خطة داخلية للمستشفى)، تُنشأ مطالبة
    // فعلية تلقائيًا يمكن للشركة متابعتها عبر بوابتها الخاصة (محرك المطالبات)
    if (member?.plan?.insurance_company_id && insuranceCoveredAmount > 0) {
      try {
        await Claim.create({
          claim_number: await generateClaimNumber(),
          invoice_id: invoice.id,
          insurance_member_id: member.id,
          insurance_company_id: member.plan.insurance_company_id,
          amount_claimed: insuranceCoveredAmount,
          status: 'submitted',
        });
      } catch (err) {
        console.error('تعذّر إنشاء مطالبة التأمين:', err.message);
      }
    }

    // قيد يومية تلقائي: تسجيل استحقاق الفاتورة - مدين ذمم المريض/التأمين، دائن إيراد الخدمات الطبية
    const patientPortion = total_amount - insuranceCoveredAmount;
    try {
      await postJournalEntry({
        description: `فاتورة ${invoice_number}`,
        referenceType: 'invoice',
        referenceId: invoice.id,
        userId: req.user.id,
        lines: [
          { code: ACCOUNT_CODES.PATIENT_RECEIVABLE, debit: patientPortion, credit: 0 },
          { code: ACCOUNT_CODES.INSURANCE_RECEIVABLE, debit: insuranceCoveredAmount, credit: 0 },
          { code: ACCOUNT_CODES.MEDICAL_SERVICES_REVENUE, debit: 0, credit: total_amount },
        ],
      });
    } catch (err) {
      console.error('تعذّر ترحيل قيد الفاتورة:', err.message);
    }

    res.status(201).json(invoice);
  }
);

// PUT /api/invoices/:id/pay - تسديد فاتورة (المبلغ المتبقي بعد تغطية التأمين إن وُجدت)
router.put('/:id/pay', authorize('admin', 'billing', 'reception'), async (req, res) => {
  const invoice = await Invoice.findByPk(req.params.id);
  if (!invoice) return res.status(404).json({ message: 'الفاتورة غير موجودة' });

  invoice.status = 'paid';
  invoice.paid_at = new Date();
  await invoice.save();

  // قيد يومية تلقائي: تحصيل نقدي من المريض يُقفل ذمته (لا يشمل حصة التأمين - تبقى ذمة منفصلة حتى تسويتها)
  const patientPortion = Number(invoice.total_amount) - Number(invoice.insurance_covered_amount);
  if (patientPortion > 0) {
    try {
      await postJournalEntry({
        description: `تحصيل فاتورة ${invoice.invoice_number}`,
        referenceType: 'invoice',
        referenceId: invoice.id,
        userId: req.user.id,
        lines: [
          { code: ACCOUNT_CODES.CASH, debit: patientPortion, credit: 0 },
          { code: ACCOUNT_CODES.PATIENT_RECEIVABLE, debit: 0, credit: patientPortion },
        ],
      });
    } catch (err) {
      console.error('تعذّر ترحيل قيد تحصيل الفاتورة:', err.message);
    }
  }

  res.json(invoice);
});

// PUT /api/invoices/:id/cancel - إلغاء فاتورة (يُعيد للعضو المؤمَّن أي مبلغ تأمين استُهلك)
router.put('/:id/cancel', authorize('admin', 'billing'), async (req, res) => {
  const invoice = await Invoice.findByPk(req.params.id);
  if (!invoice) return res.status(404).json({ message: 'الفاتورة غير موجودة' });

  if (invoice.insurance_member_id && Number(invoice.insurance_covered_amount) > 0) {
    const member = await InsuranceMember.findByPk(invoice.insurance_member_id);
    if (member) {
      member.used_amount_this_year = Math.max(0, Number(member.used_amount_this_year) - Number(invoice.insurance_covered_amount));
      await member.save();
    }
  }

  invoice.status = 'cancelled';
  await invoice.save();
  res.json(invoice);
});

module.exports = router;

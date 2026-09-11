const express = require('express');
const { Op } = require('sequelize');
const { Claim, Invoice, InsuranceMember, InsuranceCompany, Patient } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { postJournalEntry, ACCOUNT_CODES } = require('../services/accounting');
const { logAudit } = require('../services/auditLog');

const router = express.Router();

// إدارة المطالبات من طرف المستشفى (داخلي) - admin و billing فقط
router.use(authenticate, authorize('admin', 'billing'));

const INCLUDE = [
  { model: InsuranceCompany, attributes: ['id', 'name_ar', 'name_en'] },
  { model: InsuranceMember, attributes: ['id', 'full_name', 'policy_number'] },
  { model: Invoice, attributes: ['id', 'invoice_number', 'total_amount'] },
];

// GET /api/claims?status=&company_id= - كل المطالبات المقدَّمة لشركات التأمين
router.get('/', async (req, res) => {
  const { status, company_id } = req.query;
  const where = {};
  if (status) where.status = status;
  if (company_id) where.insurance_company_id = company_id;

  const claims = await Claim.findAll({ where, include: INCLUDE, order: [['submitted_at', 'DESC']] });
  res.json(claims);
});

// GET /api/claims/:id
router.get('/:id', async (req, res) => {
  const claim = await Claim.findByPk(req.params.id, { include: INCLUDE });
  if (!claim) return res.status(404).json({ message: 'المطالبة غير موجودة' });
  res.json(claim);
});

// PUT /api/claims/:id/mark-paid - تسجيل استلام المستشفى دفعة تسوية فعلية من شركة التأمين نقدًا/بنكيًا
// يُرحَّل قيد محاسبي: مدين الصندوق، دائن ذمم التأمين الصحي المدينة (تُقفل الذمة عن هذه المطالبة)
router.put('/:id/mark-paid', async (req, res) => {
  const claim = await Claim.findByPk(req.params.id);
  if (!claim) return res.status(404).json({ message: 'المطالبة غير موجودة' });
  if (claim.status === 'paid') return res.status(400).json({ message: 'تمت تسوية هذه المطالبة مسبقًا' });
  if (claim.status === 'rejected') return res.status(400).json({ message: 'لا يمكن تسوية مطالبة مرفوضة' });

  const settlementAmount = claim.amount_approved !== null ? Number(claim.amount_approved) : Number(claim.amount_claimed);
  if (settlementAmount <= 0) return res.status(400).json({ message: 'لا يوجد مبلغ لتسويته' });

  claim.status = 'paid';
  claim.paid_at = new Date();
  await claim.save();

  try {
    await postJournalEntry({
      description: `تسوية مطالبة تأمين ${claim.claim_number}`,
      referenceType: 'insurance',
      referenceId: claim.id,
      userId: req.user.id,
      lines: [
        { code: ACCOUNT_CODES.CASH, debit: settlementAmount, credit: 0 },
        { code: ACCOUNT_CODES.INSURANCE_RECEIVABLE, debit: 0, credit: settlementAmount },
      ],
    });
  } catch (err) {
    console.error('تعذّر ترحيل قيد تسوية المطالبة:', err.message);
  }

  const full = await Claim.findByPk(claim.id, { include: INCLUDE });
  await logAudit({
    req, action: 'pay', entityType: 'Claim', entityId: claim.id,
    description: `تسوية مطالبة ${claim.claim_number} بمبلغ ${settlementAmount.toLocaleString('en-US')} مع ${full.InsuranceCompany?.name_ar}`,
    after: { settlement_amount: settlementAmount },
  });
  res.json(full);
});

module.exports = router;

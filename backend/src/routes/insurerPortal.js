const express = require('express');
const { InsuranceMember, InsurancePlan, Claim, Invoice, Patient } = require('../models');
const { authenticateApiKey } = require('../middleware/apiKeyAuth');

const router = express.Router();

// بوابة شركات التأمين الخارجية - محرك المطالبات: تحقق فوري من التغطية، متابعة المطالبات، والرد
// عليها (موافقة/رفض/موافقة جزئية). مصادقة بمفتاح API خاص بكل شركة (ترويسة X-Api-Key) - ليست
// جزءًا من نظام تسجيل الدخول الداخلي (JWT) لأن الجهة المستهلكة نظام خارجي لا مستخدم بشري مسجّل هنا
router.use(authenticateApiKey);

// GET /api/insurer-portal/verify-coverage?policy_number=POL-XXXX - تحقق لحظي من حالة تغطية مشترك
// تابع لهذه الشركة تحديدًا (لا يمكن لشركة الاطلاع على بيانات مشتركي شركة أخرى أو الخطط الداخلية)
router.get('/verify-coverage', async (req, res) => {
  const { policy_number } = req.query;
  if (!policy_number) return res.status(400).json({ message: 'policy_number مطلوب' });

  const member = await InsuranceMember.findOne({
    where: { policy_number },
    include: [{ model: InsurancePlan, as: 'plan' }],
  });

  if (!member || member.plan?.insurance_company_id !== req.insuranceCompany.id) {
    return res.status(404).json({ message: 'لا يوجد مشترك بهذا الرقم تابع لشركتكم' });
  }

  const remaining = member.annual_max_coverage !== null
    ? Math.max(0, Number(member.annual_max_coverage) - Number(member.used_amount_this_year))
    : null;

  res.json({
    policy_number: member.policy_number,
    full_name: member.full_name,
    status: member.status,
    is_covered: member.status === 'active',
    coverage_percentage: Number(member.coverage_percentage),
    annual_max_coverage: member.annual_max_coverage !== null ? Number(member.annual_max_coverage) : null,
    used_amount_this_year: Number(member.used_amount_this_year),
    remaining_coverage: remaining,
    start_date: member.start_date,
    end_date: member.end_date,
    plan_name: member.plan?.name_ar,
  });
});

// GET /api/insurer-portal/claims?status= - مطالبات هذه الشركة فقط
router.get('/claims', async (req, res) => {
  const { status } = req.query;
  const where = { insurance_company_id: req.insuranceCompany.id };
  if (status) where.status = status;

  const claims = await Claim.findAll({
    where,
    include: [
      { model: InsuranceMember, attributes: ['id', 'full_name', 'policy_number'] },
      { model: Invoice, attributes: ['id', 'invoice_number', 'total_amount', 'created_at'] },
    ],
    order: [['submitted_at', 'DESC']],
  });
  res.json(claims);
});

// GET /api/insurer-portal/claims/:id - تفصيل مطالبة واحدة (يجب أن تخص هذه الشركة)
router.get('/claims/:id', async (req, res) => {
  const claim = await Claim.findOne({
    where: { id: req.params.id, insurance_company_id: req.insuranceCompany.id },
    include: [
      { model: InsuranceMember, attributes: ['id', 'full_name', 'policy_number'] },
      { model: Invoice, attributes: ['id', 'invoice_number', 'total_amount', 'items', 'created_at'] },
    ],
  });
  if (!claim) return res.status(404).json({ message: 'المطالبة غير موجودة' });
  res.json(claim);
});

// PUT /api/insurer-portal/claims/:id/respond - رد شركة التأمين على مطالبة قدّمها المستشفى
// decision: approved | partially_approved | rejected
router.put('/claims/:id/respond', async (req, res) => {
  const claim = await Claim.findOne({ where: { id: req.params.id, insurance_company_id: req.insuranceCompany.id } });
  if (!claim) return res.status(404).json({ message: 'المطالبة غير موجودة' });
  if (['paid', 'rejected'].includes(claim.status)) {
    return res.status(400).json({ message: 'تمت معالجة هذه المطالبة نهائيًا ولا يمكن تعديل الرد عليها' });
  }

  const { decision, amount_approved, rejection_reason } = req.body;
  if (!['approved', 'partially_approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ message: 'قرار غير صالح' });
  }

  if (decision === 'rejected') {
    claim.status = 'rejected';
    claim.amount_approved = 0;
    claim.rejection_reason = rejection_reason || null;
  } else {
    const approved = decision === 'approved' ? Number(claim.amount_claimed) : Number(amount_approved);
    if (!(approved > 0) || approved > Number(claim.amount_claimed)) {
      return res.status(400).json({ message: 'المبلغ المعتمد غير صالح - يجب أن يكون بين 0 والمبلغ المطالَب به' });
    }
    claim.status = decision;
    claim.amount_approved = approved;
  }
  claim.reviewed_at = new Date();
  await claim.save();

  res.json(claim);
});

module.exports = router;

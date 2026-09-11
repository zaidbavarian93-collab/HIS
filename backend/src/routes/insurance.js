const express = require('express');
const { Op } = require('sequelize');
const { InsurancePlan, InsuranceMember, User, Patient } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { postJournalEntry, ACCOUNT_CODES } = require('../services/accounting');
const { logAudit } = require('../services/auditLog');

const router = express.Router();

router.use(authenticate);

async function generatePolicyNumber() {
  const year = new Date().getFullYear();
  const count = await InsuranceMember.count();
  const serial = String(count + 1).padStart(6, '0');
  return `INS-${year}-${serial}`;
}

// ===== الخطط (Plans) =====

// GET /api/insurance/plans - قائمة خطط التأمين المتاحة (لكل المستخدمين المسجّلين)، مع اسم شركة
// التأمين المتعاقدة إن كانت الخطة تابعة لشركة خارجية بدل كونها خطة داخلية يديرها المستشفى
router.get('/plans', async (req, res) => {
  const { InsuranceCompany } = require('../models');
  const plans = await InsurancePlan.findAll({
    order: [['coverage_percentage', 'DESC']],
    include: [{ model: InsuranceCompany, attributes: ['id', 'name_ar', 'name_en'] }],
  });
  res.json(plans);
});

// POST /api/insurance/plans - إنشاء خطة تأمين جديدة (admin فقط) - insurance_company_id اختياري:
// فارغ = خطة داخلية يديرها المستشفى، محدّد = خطة تابعة لشركة خارجية متعاقدة تُنشئ مطالبات فعلية
router.post('/plans', authorize('admin'), async (req, res) => {
  const { name_ar, name_en, category, coverage_percentage, monthly_premium, annual_max_coverage, description_ar, insurance_company_id } = req.body;
  if (!name_ar || !name_en) {
    return res.status(400).json({ message: 'اسم الخطة بالعربي والإنكليزي مطلوب' });
  }
  const plan = await InsurancePlan.create({
    name_ar, name_en, category, coverage_percentage, monthly_premium,
    annual_max_coverage: annual_max_coverage || null, description_ar,
    insurance_company_id: insurance_company_id || null,
  });
  res.status(201).json(plan);
});

// PUT /api/insurance/plans/:id - تعديل خطة (admin فقط)
router.put('/plans/:id', authorize('admin'), async (req, res) => {
  const plan = await InsurancePlan.findByPk(req.params.id);
  if (!plan) return res.status(404).json({ message: 'الخطة غير موجودة' });

  const fields = ['name_ar', 'name_en', 'category', 'coverage_percentage', 'monthly_premium', 'annual_max_coverage', 'description_ar', 'is_active', 'insurance_company_id'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) plan[f] = req.body[f] === '' ? null : req.body[f];
  });
  await plan.save();
  res.json(plan);
});

// ===== الأعضاء المؤمَّنون (Members) =====

// GET /api/insurance/members?search=&status=&member_type= - قائمة المشتركين
router.get('/members', authorize('admin', 'billing', 'reception'), async (req, res) => {
  const { search, status, member_type } = req.query;
  const where = {};
  if (status) where.status = status;
  if (member_type) where.member_type = member_type;
  if (search) {
    where[Op.or] = [
      { full_name: { [Op.iLike]: `%${search}%` } },
      { policy_number: { [Op.iLike]: `%${search}%` } },
      { national_id: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const members = await InsuranceMember.findAll({
    where,
    include: [
      { model: InsurancePlan, as: 'plan' },
      { model: User, as: 'relatedStaff', attributes: ['id', 'full_name'] },
      { model: Patient, attributes: ['id', 'full_name', 'file_number'] },
    ],
    order: [['created_at', 'DESC']],
  });
  res.json(members);
});

// GET /api/insurance/members/lookup/:code - بحث سريع بالبوليصة أو رقم الهوية (لاستخدام الفوترة)
router.get('/members/lookup/:code', authorize('admin', 'billing', 'reception'), async (req, res) => {
  const member = await InsuranceMember.findOne({
    where: {
      [Op.or]: [{ policy_number: req.params.code }, { national_id: req.params.code }],
    },
    include: [{ model: InsurancePlan, as: 'plan' }],
  });
  if (!member) return res.status(404).json({ message: 'لا يوجد عضو تأمين بهذا الرقم' });
  res.json(member);
});

// POST /api/insurance/members - تسجيل مشترك جديد (مواطن، كادر، أو قريب من الدرجة الأولى)
router.post('/members', authorize('admin', 'billing', 'reception'), async (req, res) => {
  const {
    plan_id, member_type, full_name, national_id, date_of_birth, gender, phone,
    relation, related_staff_id, patient_id, start_date, notes,
  } = req.body;

  if (!plan_id || !full_name) {
    return res.status(400).json({ message: 'الخطة واسم المشترك مطلوبان' });
  }

  const plan = await InsurancePlan.findByPk(plan_id);
  if (!plan) return res.status(404).json({ message: 'الخطة غير موجودة' });

  try {
    const policy_number = await generatePolicyNumber();
    const member = await InsuranceMember.create({
      plan_id,
      member_type: member_type || 'citizen',
      full_name,
      national_id: national_id || null,
      date_of_birth: date_of_birth || null,
      gender: gender || null,
      phone: phone || null,
      relation: relation || null,
      related_staff_id: related_staff_id || null,
      patient_id: patient_id || null,
      policy_number,
      coverage_percentage: plan.coverage_percentage,
      annual_max_coverage: plan.annual_max_coverage,
      status: 'active',
      start_date: start_date || new Date().toISOString().slice(0, 10),
      notes: notes || null,
      created_by: req.user.id,
    });
    res.status(201).json(member);
  } catch (err) {
    res.status(400).json({ message: 'تعذّر تسجيل المشترك - تحقق من صحة البيانات المدخلة' });
  }
});

// POST /api/insurance/members/:id/collect-premium - تحصيل بدل الاشتراك الشهري نقدًا (يُرحَّل محاسبيًا فورًا)
router.post('/members/:id/collect-premium', authorize('admin', 'billing'), async (req, res) => {
  const member = await InsuranceMember.findByPk(req.params.id);
  if (!member) return res.status(404).json({ message: 'المشترك غير موجود' });

  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) {
    return res.status(400).json({ message: 'مبلغ التحصيل غير صالح' });
  }

  try {
    const entry = await postJournalEntry({
      description: `تحصيل بدل اشتراك تأمين - ${member.full_name} (${member.policy_number})`,
      referenceType: 'insurance',
      referenceId: member.id,
      userId: req.user.id,
      lines: [
        { code: ACCOUNT_CODES.CASH, debit: amount, credit: 0 },
        { code: ACCOUNT_CODES.INSURANCE_PREMIUM_REVENUE, debit: 0, credit: amount },
      ],
    });
    await logAudit({
      req, action: 'collect_premium', entityType: 'InsuranceMember', entityId: member.id,
      description: `تحصيل بدل اشتراك ${amount.toLocaleString('en-US')} من ${member.full_name} (${member.policy_number})`,
      after: { amount },
    });
    res.status(201).json({ message: 'تم تحصيل البدل وترحيله محاسبيًا', entry });
  } catch (err) {
    res.status(400).json({ message: err.message || 'تعذّر ترحيل قيد التحصيل' });
  }
});

// PUT /api/insurance/members/:id - تعديل/تجديد/إيقاف اشتراك
router.put('/members/:id', authorize('admin', 'billing', 'reception'), async (req, res) => {
  const member = await InsuranceMember.findByPk(req.params.id);
  if (!member) return res.status(404).json({ message: 'المشترك غير موجود' });

  const fields = [
    'full_name', 'national_id', 'date_of_birth', 'gender', 'phone', 'relation',
    'related_staff_id', 'patient_id', 'status', 'start_date', 'end_date', 'notes',
  ];
  const statusChanged = req.body.status !== undefined && req.body.status !== member.status;
  const oldStatus = member.status;
  fields.forEach((f) => {
    if (req.body[f] !== undefined) member[f] = req.body[f] === '' ? null : req.body[f];
  });

  await member.save();
  if (statusChanged) {
    await logAudit({
      req, action: 'update', entityType: 'InsuranceMember', entityId: member.id,
      description: `تغيير حالة اشتراك ${member.full_name} (${member.policy_number}) من "${oldStatus}" إلى "${member.status}"`,
      before: { status: oldStatus }, after: { status: member.status },
    });
  }
  res.json(member);
});

module.exports = router;

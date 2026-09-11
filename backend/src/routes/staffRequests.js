const express = require('express');
const { StaffRequest, User, Department } = require('../models');
const { authenticate, authorize, requireDepartmentHead } = require('../middleware/auth');
const { logAudit } = require('../services/auditLog');

const router = express.Router();

router.use(authenticate);

const INCLUDE = [
  { model: User, as: 'requester', attributes: ['id', 'full_name', 'username'] },
  { model: User, as: 'targetUser', attributes: ['id', 'full_name', 'username', 'role'] },
  { model: User, as: 'reviewer', attributes: ['id', 'full_name'] },
  { model: Department, attributes: ['id', 'name_ar'] },
];

// يمنع تسرّب الراتب أو كلمة المرور عبر مسار طلبات رؤساء الأقسام مهما كان محتوى الطلب -
// هذه الصلاحية تبقى بيد مدير النظام حصرًا ولا يمكن التحايل عليها من هذا المسار إطلاقًا
// الدور مسموح فقط عند "إضافة" موظف جديد (لتحديد فئته الوظيفية) - ممنوع تغييره في التعديل/النقل
function stripForbiddenFields(payload, requestType) {
  const clean = { ...(payload || {}) };
  delete clean.base_salary;
  delete clean.password;
  if (requestType !== 'add') delete clean.role;
  return clean;
}

// GET /api/staff-requests?status= - رؤساء الأقسام يرون طلباتهم فقط، ومدير النظام يرى الكل
router.get('/', async (req, res) => {
  const { status } = req.query;
  const where = {};
  if (status) where.status = status;
  if (req.user.role !== 'admin') {
    if (!req.user.is_department_head) return res.status(403).json({ message: 'لا تملك صلاحية للقيام بهذا الإجراء' });
    where.requested_by = req.user.id;
  }

  const requests = await StaffRequest.findAll({
    where,
    include: INCLUDE,
    order: [['createdAt', 'DESC']],
  });
  res.json(requests);
});

// POST /api/staff-requests - رئيس القسم يقدّم طلب نقل/إضافة/تعديل/حذف كادر ضمن قسمه فقط
router.post('/', requireDepartmentHead, async (req, res) => {
  const { request_type, target_user_id, payload } = req.body;
  if (!['add', 'edit', 'transfer', 'delete'].includes(request_type)) {
    return res.status(400).json({ message: 'نوع طلب غير صالح' });
  }

  const cleanPayload = stripForbiddenFields(payload, request_type);

  if (request_type === 'add') {
    if (!cleanPayload.full_name || !cleanPayload.username || !cleanPayload.role) {
      return res.status(400).json({ message: 'الاسم واسم المستخدم والدور مطلوبة لإضافة كادر جديد' });
    }
    // رئيس القسم لا يمكنه اقتراح إضافة مدير نظام أو محاسب - هذه الأدوار تبقى بيد مدير النظام مباشرة
    if (['admin', 'billing'].includes(cleanPayload.role)) {
      return res.status(403).json({ message: 'لا يمكن طلب إضافة موظف بهذا الدور عبر رؤساء الأقسام' });
    }
    cleanPayload.department_id = req.user.department_id; // لا يمكن الإضافة إلا ضمن قسمه هو
  } else {
    if (!target_user_id) return res.status(400).json({ message: 'الموظف المستهدف مطلوب' });
    const target = await User.findByPk(target_user_id);
    if (!target) return res.status(404).json({ message: 'الموظف غير موجود' });
    if (target.department_id !== req.user.department_id) {
      return res.status(403).json({ message: 'لا يمكنك تقديم طلب بخصوص موظف خارج قسمك' });
    }
  }

  const request = await StaffRequest.create({
    request_type,
    requested_by: req.user.id,
    department_id: req.user.department_id,
    target_user_id: target_user_id || null,
    payload: cleanPayload,
    status: 'pending',
  });

  const full = await StaffRequest.findByPk(request.id, { include: INCLUDE });
  res.status(201).json(full);
});

// PUT /api/staff-requests/:id/approve - مدير النظام يوافق وينفّذ التغيير فعليًا
// base_salary_override اختياري: يسمح لمدير النظام بتحديد راتب الموظف الجديد عند الموافقة على "إضافة"
router.put('/:id/approve', authorize('admin'), async (req, res) => {
  const request = await StaffRequest.findByPk(req.params.id);
  if (!request) return res.status(404).json({ message: 'الطلب غير موجود' });
  if (request.status !== 'pending') return res.status(400).json({ message: 'تمت معالجة هذا الطلب مسبقًا' });

  const payload = stripForbiddenFields(request.payload, request.request_type);
  const { base_salary_override, review_note } = req.body;

  try {
    if (request.request_type === 'add') {
      if (!req.body.password || String(req.body.password).length < 6) {
        return res.status(400).json({ message: 'يجب على مدير النظام تحديد كلمة مرور (6 أحرف فأكثر) عند الموافقة على إضافة الموظف' });
      }
      const created = await User.create({
        ...payload,
        password_hash: req.body.password,
        base_salary: base_salary_override || 0,
      });
      request.target_user_id = created.id;
    } else {
      const target = await User.findByPk(request.target_user_id);
      if (!target) return res.status(404).json({ message: 'الموظف المستهدف لم يعد موجودًا' });

      if (request.request_type === 'edit') {
        // حقول فارغة تعني "أبقِ القيمة القديمة كما هي" (كما توحي واجهة تقديم الطلب) - لا يجوز أن
        // تُفرغ حقلًا موجودًا فعليًا، خصوصًا full_name الذي لا يقبل قيمة فارغة أصلًا
        const fieldsToApply = {};
        Object.entries(payload).forEach(([key, value]) => {
          if (value !== '' && value !== null && value !== undefined) fieldsToApply[key] = value;
        });
        await target.update(fieldsToApply);
        if (base_salary_override !== undefined) await target.update({ base_salary: base_salary_override });
      } else if (request.request_type === 'transfer') {
        if (!payload.new_department_id) return res.status(400).json({ message: 'القسم الجديد غير محدد في الطلب' });
        await target.update({ department_id: payload.new_department_id });
      } else if (request.request_type === 'delete') {
        await target.update({ is_active: false });
      }
    }

    request.status = 'approved';
    request.reviewed_by = req.user.id;
    request.reviewed_at = new Date();
    if (review_note) request.review_note = review_note;
    await request.save();

    const full = await StaffRequest.findByPk(request.id, { include: INCLUDE });
    await logAudit({
      req, action: 'approve', entityType: 'StaffRequest', entityId: request.id,
      description: `موافقة على طلب ${request.request_type} من ${full.requester?.full_name} بخصوص ${full.targetUser?.full_name || payload.full_name || '-'}`,
      after: { request_type: request.request_type, target_user_id: request.target_user_id, base_salary_override: base_salary_override ?? null },
    });
    res.json(full);
  } catch (err) {
    res.status(400).json({ message: err.message || 'تعذّر تنفيذ الطلب' });
  }
});

// PUT /api/staff-requests/:id/reject - مدير النظام يرفض الطلب مع ملاحظة اختيارية
router.put('/:id/reject', authorize('admin'), async (req, res) => {
  const request = await StaffRequest.findByPk(req.params.id);
  if (!request) return res.status(404).json({ message: 'الطلب غير موجود' });
  if (request.status !== 'pending') return res.status(400).json({ message: 'تمت معالجة هذا الطلب مسبقًا' });

  request.status = 'rejected';
  request.reviewed_by = req.user.id;
  request.reviewed_at = new Date();
  request.review_note = req.body.review_note || null;
  await request.save();

  const full = await StaffRequest.findByPk(request.id, { include: INCLUDE });
  await logAudit({
    req, action: 'reject', entityType: 'StaffRequest', entityId: request.id,
    description: `رفض طلب ${request.request_type} من ${full.requester?.full_name}${request.review_note ? ` - السبب: ${request.review_note}` : ''}`,
  });
  res.json(full);
});

module.exports = router;

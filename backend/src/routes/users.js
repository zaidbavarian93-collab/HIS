const express = require('express');
const path = require('path');
const { body, validationResult } = require('express-validator');
const { User, ROLES } = require('../models/User');
const { Department } = require('../models');
const { authenticate, authorize, requireDepartmentHead } = require('../middleware/auth');
const { logAudit } = require('../services/auditLog');
const { upload, CERT_DIR } = require('../middleware/upload');

const router = express.Router();

const PUBLIC_ATTRIBUTES = [
  'id', 'full_name', 'username', 'role', 'department_id', 'is_active', 'base_salary',
  'date_of_birth', 'gender', 'phone', 'email', 'qualification', 'job_grade',
  'marital_status', 'external_affiliation', 'certificate_file', 'certificate_original_name', 'notes',
  'is_department_head',
];

// GET /api/users/doctors - قائمة مختصرة بالأطباء (متاحة للاستقبال أيضًا لأغراض حجز المواعيد)
router.get('/doctors', authenticate, authorize('admin', 'reception', 'doctor', 'nurse'), async (req, res) => {
  const doctors = await User.findAll({
    where: { role: 'doctor', is_active: true },
    attributes: ['id', 'full_name', 'department_id'],
    order: [['full_name', 'ASC']],
  });
  res.json(doctors);
});

// GET /api/users/department-staff - قائمة مختصرة (بلا راتب) بكادر قسم رئيس القسم نفسه فقط
// تُستخدم لبناء طلبات النقل/التعديل/الحذف دون الحاجة لصلاحية admin الكاملة على /users
router.get('/department-staff', authenticate, requireDepartmentHead, async (req, res) => {
  const staff = await User.findAll({
    where: { department_id: req.user.department_id },
    attributes: ['id', 'full_name', 'username', 'role', 'job_grade', 'is_active'],
    order: [['full_name', 'ASC']],
  });
  res.json(staff);
});

// باقي مسارات إدارة المستخدمين تتطلب صلاحية admin فقط
router.use(authenticate, authorize('admin'));

// GET /api/users - قائمة المستخدمين بكل التفاصيل (مع اسم القسم/جهة الانتساب)
router.get('/', async (req, res) => {
  const users = await User.findAll({
    attributes: PUBLIC_ATTRIBUTES,
    include: [{ model: Department, attributes: ['id', 'name_ar', 'name_en'] }],
    order: [['full_name', 'ASC']],
  });
  res.json(users);
});

// الحقول الفارغة ('') يجب تحويلها إلى null بدل تركها كنص فارغ لأعمدة التاريخ
// (تاريخ ميلاد فارغ كان يُسقط الخادم بالكامل سابقًا - نفس مشكلة المرضى)
function sanitizeStaffInput(body) {
  const sanitized = { ...body };
  [
    'date_of_birth', 'gender', 'phone', 'email', 'qualification', 'job_grade',
    'marital_status', 'external_affiliation', 'notes', 'department_id',
  ].forEach((field) => {
    if (sanitized[field] === '') sanitized[field] = null;
  });
  return sanitized;
}

// POST /api/users - تسجيل موظف جديد (طبيب أو أي فئة أخرى) ببياناته الكاملة
router.post(
  '/',
  [
    body('full_name').notEmpty().withMessage('الاسم الكامل مطلوب'),
    body('username').notEmpty().withMessage('اسم المستخدم مطلوب'),
    body('password').isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
    body('role').isIn(ROLES).withMessage('دور غير صالح'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const data = sanitizeStaffInput(req.body);
      const user = await User.create({
        full_name: data.full_name,
        username: data.username,
        password_hash: data.password, // يُشفَّر تلقائيًا في hook قبل الحفظ
        role: data.role,
        department_id: data.department_id || null,
        base_salary: data.base_salary || 0,
        date_of_birth: data.date_of_birth,
        gender: data.gender,
        phone: data.phone,
        email: data.email,
        qualification: data.qualification,
        job_grade: data.job_grade,
        marital_status: data.marital_status,
        external_affiliation: data.external_affiliation,
        notes: data.notes,
      });

      await logAudit({
        req, action: 'create', entityType: 'User', entityId: user.id,
        description: `إضافة موظف جديد: ${user.full_name} (${user.username}) - الدور: ${user.role}`,
        after: { full_name: user.full_name, username: user.username, role: user.role, base_salary: user.base_salary, department_id: user.department_id },
      });
      res.status(201).json({ id: user.id, full_name: user.full_name, username: user.username, role: user.role });
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ message: 'اسم المستخدم موجود مسبقًا' });
      }
      res.status(400).json({ message: 'حدث خطأ أثناء إنشاء المستخدم - تحقق من صحة البيانات المدخلة' });
    }
  }
);

// PUT /api/users/:id - تعديل بيانات موظف (شخصية ومهنية، تفعيل/تعطيل، دور، راتب)
router.put('/:id', async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

  const data = sanitizeStaffInput(req.body);
  const editableFields = [
    'full_name', 'role', 'department_id', 'is_active', 'base_salary',
    'date_of_birth', 'gender', 'phone', 'email', 'qualification', 'job_grade',
    'marital_status', 'external_affiliation', 'notes', 'is_department_head',
  ];
  // لقطة "قبل" محصورة بالحقول التي فعليًا سيطالها التعديل - أهمها الراتب والدور والحالة والصلاحية
  const before = {};
  const after = {};
  let changedSensitiveField = false;
  const SENSITIVE = ['base_salary', 'role', 'is_active', 'is_department_head'];
  editableFields.forEach((field) => {
    if (data[field] !== undefined && String(user[field]) !== String(data[field])) {
      before[field] = user[field];
      after[field] = data[field];
      if (SENSITIVE.includes(field)) changedSensitiveField = true;
    }
    if (data[field] !== undefined) user[field] = data[field];
  });
  const passwordChanged = !!data.password;
  if (data.password) user.password_hash = data.password; // يُشفَّر تلقائيًا في hook

  try {
    await user.save();
    if (Object.keys(after).length > 0 || passwordChanged) {
      await logAudit({
        req, action: 'update', entityType: 'User', entityId: user.id,
        description: passwordChanged && Object.keys(after).length === 0
          ? `تغيير كلمة مرور: ${user.full_name} (${user.username})`
          : `تعديل بيانات موظف${changedSensitiveField ? ' (تغيير حساس: راتب/دور/حالة)' : ''}: ${user.full_name} (${user.username})`,
        before, after: passwordChanged ? { ...after, password: 'تم تغييرها' } : after,
      });
    }
    res.json({ message: 'تم تحديث بيانات المستخدم' });
  } catch (err) {
    res.status(400).json({ message: 'تعذّر تحديث بيانات المستخدم - تحقق من صحة البيانات المدخلة' });
  }
});

// DELETE /api/users/:id - حذف موظف نهائيًا (يُفضَّل التعطيل بدل الحذف إن كان له سجلات مرتبطة)
router.delete('/:id', async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });
  if (user.id === req.user.id) {
    return res.status(400).json({ message: 'لا يمكنك حذف حسابك الخاص' });
  }

  try {
    await user.destroy();
    await logAudit({
      req, action: 'delete', entityType: 'User', entityId: user.id,
      description: `حذف موظف: ${user.full_name} (${user.username}) - الدور: ${user.role}`,
      before: { full_name: user.full_name, username: user.username, role: user.role },
    });
    res.json({ message: 'تم حذف الموظف' });
  } catch (err) {
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(409).json({ message: 'لا يمكن حذف هذا الموظف لوجود سجلات مرتبطة به (حضور/رواتب/مواعيد) - يمكنك تعطيل حسابه بدلًا من الحذف' });
    }
    res.status(400).json({ message: 'تعذّر حذف الموظف' });
  }
});

// POST /api/users/:id/certificate - رفع ملف الشهادة (PDF أو صورة)
router.post('/:id/certificate', upload.single('certificate'), async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });
  if (!req.file) return res.status(400).json({ message: 'لم يتم إرفاق ملف' });

  user.certificate_file = req.file.filename;
  user.certificate_original_name = req.file.originalname;
  await user.save();
  res.status(201).json({ message: 'تم رفع الشهادة بنجاح', certificate_original_name: user.certificate_original_name });
});

// GET /api/users/:id/certificate - تنزيل ملف الشهادة المرفوع
router.get('/:id/certificate', async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user || !user.certificate_file) return res.status(404).json({ message: 'لا توجد شهادة مرفوعة' });

  const filePath = path.join(CERT_DIR, user.certificate_file);
  res.download(filePath, user.certificate_original_name || user.certificate_file);
});

module.exports = router;

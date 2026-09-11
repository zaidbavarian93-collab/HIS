const express = require('express');
const fs = require('fs');
const path = require('path');
const { Department, DepartmentCategory, DoctorDepartment, User, Appointment } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadDepartmentLogo, LOGO_DIR } = require('../middleware/departmentLogoUpload');
const { logAudit } = require('../services/auditLog');

const router = express.Router();

router.use(authenticate);

// GET /api/departments - كل الأقسام مع فئاتها والأطباء المرتبطين بها وعدد المراجعين (زيارات/مواعيد) لكل قسم
router.get('/', async (req, res) => {
  const [departments, visitCounts] = await Promise.all([
    Department.findAll({
      order: [['name_ar', 'ASC']],
      include: [
        { model: DepartmentCategory, as: 'categories' },
        {
          model: DoctorDepartment,
          include: [
            { model: User, as: 'doctor', attributes: ['id', 'full_name'] },
            { model: DepartmentCategory, as: 'category', attributes: ['id', 'name_ar', 'name_en'] },
          ],
        },
      ],
    }),
    Appointment.findAll({
      attributes: ['department_id', [Appointment.sequelize.fn('COUNT', Appointment.sequelize.col('id')), 'visits_count']],
      group: ['department_id'],
      raw: true,
    }),
  ]);

  const visitsByDept = {};
  visitCounts.forEach((v) => { visitsByDept[v.department_id] = Number(v.visits_count); });

  const withVisits = departments.map((d) => ({ ...d.toJSON(), visits_count: visitsByDept[d.id] || 0 }));
  res.json(withVisits);
});

// POST /api/departments - إنشاء قسم جديد (admin فقط)
router.post('/', authorize('admin'), async (req, res) => {
  const { name_ar, name_en, type, consultation_fee } = req.body;
  if (!name_ar || !name_en) {
    return res.status(400).json({ message: 'اسم القسم بالعربي والإنكليزي مطلوب' });
  }
  const department = await Department.create({ name_ar, name_en, type, consultation_fee });
  res.status(201).json(department);
});

// PUT /api/departments/:id/fee - تعديل رسم الكشف فقط (admin والمحاسبة billing)
router.put('/:id/fee', authorize('admin', 'billing'), async (req, res) => {
  const department = await Department.findByPk(req.params.id);
  if (!department) return res.status(404).json({ message: 'القسم غير موجود' });

  const { consultation_fee } = req.body;
  if (consultation_fee === undefined || Number(consultation_fee) < 0) {
    return res.status(400).json({ message: 'رسم غير صالح' });
  }
  const oldFee = department.consultation_fee;
  department.consultation_fee = consultation_fee;
  await department.save();
  await logAudit({
    req, action: 'update', entityType: 'Department', entityId: department.id,
    description: `تعديل رسم كشف "${department.name_ar}" من ${Number(oldFee).toLocaleString('en-US')} إلى ${Number(consultation_fee).toLocaleString('en-US')}`,
    before: { consultation_fee: oldFee }, after: { consultation_fee },
  });
  res.json(department);
});

// POST /api/departments/:id/logo - رفع/استبدال شعار القسم (صورة من الحاسوب) - admin فقط
router.post('/:id/logo', authorize('admin'), uploadDepartmentLogo.single('logo'), async (req, res) => {
  const department = await Department.findByPk(req.params.id);
  if (!department) return res.status(404).json({ message: 'القسم غير موجود' });
  if (!req.file) return res.status(400).json({ message: 'لم يتم إرفاق ملف' });

  // حذف الشعار القديم إن وُجد لتفادي تراكم ملفات يتيمة على القرص
  if (department.logo_file) {
    const oldPath = path.join(LOGO_DIR, department.logo_file);
    fs.unlink(oldPath, () => {});
  }

  department.logo_file = req.file.filename;
  department.logo_original_name = req.file.originalname;
  await department.save();
  res.status(201).json(department);
});

// DELETE /api/departments/:id/logo - إزالة الشعار المخصص والعودة للأيقونة الافتراضية - admin فقط
router.delete('/:id/logo', authorize('admin'), async (req, res) => {
  const department = await Department.findByPk(req.params.id);
  if (!department) return res.status(404).json({ message: 'القسم غير موجود' });

  if (department.logo_file) {
    const oldPath = path.join(LOGO_DIR, department.logo_file);
    fs.unlink(oldPath, () => {});
  }
  department.logo_file = null;
  department.logo_original_name = null;
  await department.save();
  res.json(department);
});

// POST /api/departments/:id/categories - إضافة فئة فرعية لقسم (admin فقط)
router.post('/:id/categories', authorize('admin'), async (req, res) => {
  const { name_ar, name_en } = req.body;
  if (!name_ar || !name_en) {
    return res.status(400).json({ message: 'اسم الفئة بالعربي والإنكليزي مطلوب' });
  }
  const category = await DepartmentCategory.create({
    department_id: req.params.id,
    name_ar,
    name_en,
  });
  res.status(201).json(category);
});

// DELETE /api/departments/categories/:categoryId - حذف فئة (admin فقط)
router.delete('/categories/:categoryId', authorize('admin'), async (req, res) => {
  await DepartmentCategory.destroy({ where: { id: req.params.categoryId } });
  res.json({ message: 'تم حذف الفئة' });
});

// POST /api/departments/:id/doctors - ربط طبيب بقسم (وفئة اختيارية) (admin فقط)
router.post('/:id/doctors', authorize('admin'), async (req, res) => {
  const { doctor_id, category_id } = req.body;
  if (!doctor_id) {
    return res.status(400).json({ message: 'يجب تحديد الطبيب' });
  }
  try {
    const link = await DoctorDepartment.create({
      doctor_id,
      department_id: req.params.id,
      category_id: category_id || null,
    });
    res.status(201).json(link);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'الطبيب مرتبط مسبقًا بهذا القسم/الفئة' });
    }
    res.status(500).json({ message: 'حدث خطأ أثناء ربط الطبيب بالقسم' });
  }
});

// DELETE /api/departments/doctor-links/:linkId - إلغاء ربط طبيب بقسم (admin فقط)
router.delete('/doctor-links/:linkId', authorize('admin'), async (req, res) => {
  await DoctorDepartment.destroy({ where: { id: req.params.linkId } });
  res.json({ message: 'تم إلغاء الربط' });
});

module.exports = router;

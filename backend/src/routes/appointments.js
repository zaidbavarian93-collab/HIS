const express = require('express');
const { Op } = require('sequelize');
const { body, validationResult } = require('express-validator');
const { Appointment, Patient, User, Department } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// أدوار الاستقبال/الإدارة/المحاسبة/الإدارة العليا تحتاج رؤية شاملة لكل الأقسام لأداء عملها
// (حجز مواعيد عبر أقسام متعددة، تقارير، فوترة) - أما بقية الكوادر الطبية/الفنية فتُقيَّد بقسمها فقط
const HOSPITAL_WIDE_ROLES = ['admin', 'management', 'billing', 'reception'];

// GET /api/appointments?date=YYYY-MM-DD&doctor_id=... - قائمة المواعيد (بحسب اليوم/الطبيب)
// تُعرض مواعيد القسم الخاص بالمستخدم فقط لغير الأدوار الإدارية/الاستقبال (عزل بيانات حسب القسم)
router.get('/', async (req, res) => {
  const { date, doctor_id, patient_id } = req.query;
  const where = {};

  if (date) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59`);
    where.scheduled_at = { [Op.between]: [start, end] };
  }
  if (doctor_id) where.doctor_id = doctor_id;
  if (patient_id) where.patient_id = patient_id;
  if (!HOSPITAL_WIDE_ROLES.includes(req.user.role)) {
    where.department_id = req.user.department_id || null;
  }

  const appointments = await Appointment.findAll({
    where,
    include: [
      { model: Patient, attributes: ['id', 'full_name', 'file_number', 'phone'] },
      { model: User, as: 'doctor', attributes: ['id', 'full_name'] },
      { model: Department, attributes: ['id', 'name_ar', 'name_en'] },
    ],
    order: [['scheduled_at', 'ASC']],
  });
  res.json(appointments);
});

// POST /api/appointments - حجز موعد جديد
router.post(
  '/',
  authorize('admin', 'reception'),
  [
    body('patient_id').notEmpty().withMessage('المريض مطلوب'),
    body('doctor_id').notEmpty().withMessage('الطبيب مطلوب'),
    body('department_id').notEmpty().withMessage('القسم مطلوب'),
    body('scheduled_at').notEmpty().withMessage('موعد الزيارة مطلوب'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const appointment = await Appointment.create({
      ...req.body,
      created_by: req.user.id,
    });
    res.status(201).json(appointment);
  }
);

// PUT /api/appointments/:id/status - تحديث حالة الموعد (وصل، قيد الكشف، انتهى، إلخ)
router.put('/:id/status', authorize('admin', 'reception', 'doctor', 'nurse'), async (req, res) => {
  const { status } = req.body;
  const appointment = await Appointment.findByPk(req.params.id);
  if (!appointment) return res.status(404).json({ message: 'الموعد غير موجود' });
  if (!HOSPITAL_WIDE_ROLES.includes(req.user.role) && appointment.department_id !== req.user.department_id) {
    return res.status(403).json({ message: 'لا يمكنك التعديل على موعد خارج قسمك' });
  }

  appointment.status = status;
  await appointment.save();
  res.json(appointment);
});

module.exports = router;

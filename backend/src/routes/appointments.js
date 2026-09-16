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
// عند الانتقال إلى checked_in لأول مرة: يُولَّد رقم تذكرة تسلسلي لهذا القسم/اليوم وينضم المريض لطابور الانتظار
router.put('/:id/status', authorize('admin', 'reception', 'doctor', 'nurse'), async (req, res) => {
  const { status } = req.body;
  const appointment = await Appointment.findByPk(req.params.id);
  if (!appointment) return res.status(404).json({ message: 'الموعد غير موجود' });
  if (!HOSPITAL_WIDE_ROLES.includes(req.user.role) && appointment.department_id !== req.user.department_id) {
    return res.status(403).json({ message: 'لا يمكنك التعديل على موعد خارج قسمك' });
  }

  if (status === 'checked_in' && !appointment.queue_number) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const lastInQueue = await Appointment.max('queue_number', {
      where: {
        department_id: appointment.department_id,
        checked_in_at: { [Op.between]: [todayStart, todayEnd] },
      },
    });
    appointment.queue_number = (lastInQueue || 0) + 1;
    appointment.checked_in_at = new Date();
  }

  appointment.status = status;
  await appointment.save();
  res.json(appointment);
});

// PUT /api/appointments/:id/priority - تمييز حالة كعاجلة لتتقدّم في طابور الانتظار (أو إعادتها لعادية)
router.put('/:id/priority', authorize('admin', 'reception', 'doctor', 'nurse'), async (req, res) => {
  const { priority } = req.body;
  if (!['normal', 'urgent'].includes(priority)) {
    return res.status(400).json({ message: 'أولوية غير صالحة' });
  }
  const appointment = await Appointment.findByPk(req.params.id);
  if (!appointment) return res.status(404).json({ message: 'الموعد غير موجود' });
  if (!HOSPITAL_WIDE_ROLES.includes(req.user.role) && appointment.department_id !== req.user.department_id) {
    return res.status(403).json({ message: 'لا يمكنك التعديل على موعد خارج قسمك' });
  }

  appointment.priority = priority;
  await appointment.save();
  res.json(appointment);
});

// GET /api/appointments/queue/board - لوحة طابور الانتظار الحية لليوم الحالي
// ترتيب الطابور: العاجل أولًا، ثم حسب رقم التذكرة تصاعديًا - ويُعاد "قيد الكشف" و"قائمة الانتظار" منفصلين لكل قسم
router.get('/queue/board', async (req, res) => {
  const { department_id } = req.query;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const where = {
    status: { [Op.in]: ['checked_in', 'in_progress'] },
    checked_in_at: { [Op.between]: [todayStart, todayEnd] },
  };
  if (department_id) where.department_id = department_id;
  if (!HOSPITAL_WIDE_ROLES.includes(req.user.role)) {
    where.department_id = req.user.department_id || null;
  }

  const entries = await Appointment.findAll({
    where,
    include: [
      { model: Patient, attributes: ['id', 'full_name', 'file_number', 'phone'] },
      { model: User, as: 'doctor', attributes: ['id', 'full_name'] },
      { model: Department, attributes: ['id', 'name_ar', 'name_en'] },
    ],
    order: [
      ['priority', 'DESC'], // urgent > normal أبجديًا بالصدفة، لكن نضمن الترتيب الصريح بالأسفل
      ['queue_number', 'ASC'],
    ],
  });

  // فرز صريح إضافي كي لا نعتمد على الترتيب الأبجدي للـ ENUM في قاعدة البيانات
  entries.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === 'urgent' ? -1 : 1;
    return (a.queue_number || 0) - (b.queue_number || 0);
  });

  res.json({
    nowServing: entries.filter((e) => e.status === 'in_progress'),
    waiting: entries.filter((e) => e.status === 'checked_in'),
  });
});

module.exports = router;

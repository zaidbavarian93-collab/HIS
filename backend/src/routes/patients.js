const express = require('express');
const { Op } = require('sequelize');
const { body, validationResult } = require('express-validator');
const { Patient, MedicalRecord, Invoice, Appointment, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// توليد رقم ملف تسلسلي بصيغة HOSP-السنة-الرقم
async function generateFileNumber() {
  const year = new Date().getFullYear();
  const count = await Patient.count();
  const serial = String(count + 1).padStart(6, '0');
  return `HOSP-${year}-${serial}`;
}

// GET /api/patients?search=... - بحث بالاسم أو رقم الملف أو رقم الهاتف
router.get('/', authorize('admin', 'reception', 'doctor', 'nurse', 'billing'), async (req, res) => {
  const { search } = req.query;
  const where = search
    ? {
        [Op.or]: [
          { full_name: { [Op.iLike]: `%${search}%` } },
          { file_number: { [Op.iLike]: `%${search}%` } },
          { phone: { [Op.iLike]: `%${search}%` } },
        ],
      }
    : {};

  const patients = await Patient.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: 50,
  });
  res.json(patients);
});

// GET /api/patients/:id - ملف مريض كامل (بيانات + زيارات + فواتير)
router.get('/:id', authorize('admin', 'reception', 'doctor', 'nurse', 'billing'), async (req, res) => {
  const patient = await Patient.findByPk(req.params.id, {
    include: [
      {
        model: MedicalRecord,
        include: [{ model: User, as: 'doctor', attributes: ['id', 'full_name'] }],
        order: [['visit_date', 'DESC']],
      },
      { model: Invoice, order: [['created_at', 'DESC']] },
      {
        model: Appointment,
        include: [{ model: User, as: 'doctor', attributes: ['id', 'full_name'] }],
      },
    ],
  });

  if (!patient) return res.status(404).json({ message: 'المريض غير موجود' });
  res.json(patient);
});

// الحقول النصية الفارغة (خاصة تاريخ الميلاد) يجب تحويلها إلى null بدل تركها ''
// فقاعدة البيانات ترفض '' كقيمة لعمود تاريخ وتسبب خطأ غير متوقع
const NULLABLE_FIELDS = [
  'date_of_birth', 'national_id', 'phone', 'address', 'gender', 'blood_type', 'allergies',
  'emergency_contact_name', 'emergency_contact_phone', 'chronic_diseases', 'disabilities',
  'current_medications', 'past_surgeries', 'family_medical_history', 'smoking_status',
  'height_cm', 'weight_kg', 'marital_status', 'occupation', 'nationality',
  'insurance_provider', 'insurance_number', 'notes',
];

function sanitizePatientInput(body) {
  const sanitized = { ...body };
  NULLABLE_FIELDS.forEach((field) => {
    if (sanitized[field] === '') sanitized[field] = null;
  });
  return sanitized;
}

// POST /api/patients - تسجيل مريض جديد (استقبال أو إدارة)
router.post(
  '/',
  authorize('admin', 'reception'),
  [body('full_name').notEmpty().withMessage('اسم المريض مطلوب')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const file_number = await generateFileNumber();
      const patient = await Patient.create({ ...sanitizePatientInput(req.body), file_number });
      res.status(201).json(patient);
    } catch (err) {
      res.status(400).json({ message: 'تعذّر تسجيل المريض - تحقق من صحة البيانات المدخلة' });
    }
  }
);

// PUT /api/patients/:id - تعديل بيانات مريض (يشمل السجل الصحي، متاح أيضًا للكادر الطبي)
router.put('/:id', authorize('admin', 'reception', 'doctor', 'nurse'), async (req, res) => {
  const patient = await Patient.findByPk(req.params.id);
  if (!patient) return res.status(404).json({ message: 'المريض غير موجود' });

  const { file_number, id, ...updatableFields } = req.body; // منع تعديل رقم الملف
  try {
    await patient.update(sanitizePatientInput(updatableFields));
    res.json(patient);
  } catch (err) {
    res.status(400).json({ message: 'تعذّر تحديث بيانات المريض - تحقق من صحة البيانات المدخلة' });
  }
});

module.exports = router;

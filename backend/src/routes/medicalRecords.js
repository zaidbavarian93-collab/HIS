const express = require('express');
const { body, validationResult } = require('express-validator');
const { MedicalRecord } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// POST /api/medical-records - إضافة تسجيلة طبية (طبيب فقط)
router.post(
  '/',
  authorize('doctor', 'admin'),
  [
    body('patient_id').notEmpty().withMessage('المريض مطلوب'),
    body('diagnosis').optional(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const record = await MedicalRecord.create({
      ...req.body,
      doctor_id: req.user.id,
    });
    res.status(201).json(record);
  }
);

// PUT /api/medical-records/:id - تعديل تسجيلة (الطبيب صاحب التسجيلة أو admin فقط)
router.put('/:id', authorize('doctor', 'admin'), async (req, res) => {
  const record = await MedicalRecord.findByPk(req.params.id);
  if (!record) return res.status(404).json({ message: 'التسجيلة غير موجودة' });

  if (req.user.role === 'doctor' && record.doctor_id !== req.user.id) {
    return res.status(403).json({ message: 'لا يمكنك تعديل تسجيلة طبيب آخر' });
  }

  const { patient_id, doctor_id, id, ...updatableFields } = req.body;
  await record.update(updatableFields);
  res.json(record);
});

module.exports = router;

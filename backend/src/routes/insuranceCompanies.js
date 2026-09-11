const express = require('express');
const crypto = require('crypto');
const { InsuranceCompany } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { logAudit } = require('../services/auditLog');

const router = express.Router();

router.use(authenticate, authorize('admin', 'billing'));

// GET /api/insurance-companies - كل شركات التأمين المتعاقدة
router.get('/', async (req, res) => {
  const companies = await InsuranceCompany.findAll({ order: [['name_ar', 'ASC']] });
  res.json(companies);
});

// POST /api/insurance-companies - إضافة شركة تأمين جديدة (admin فقط) - يُولَّد مفتاح API تلقائيًا
router.post('/', authorize('admin'), async (req, res) => {
  const { name_ar, name_en, contact_person, phone, email, address, notes } = req.body;
  if (!name_ar || !name_en) return res.status(400).json({ message: 'اسم الشركة بالعربي والإنكليزي مطلوب' });

  const company = await InsuranceCompany.create({ name_ar, name_en, contact_person, phone, email, address, notes });
  res.status(201).json(company);
});

// PUT /api/insurance-companies/:id - تعديل بيانات شركة (admin فقط)
router.put('/:id', authorize('admin'), async (req, res) => {
  const company = await InsuranceCompany.findByPk(req.params.id);
  if (!company) return res.status(404).json({ message: 'الشركة غير موجودة' });

  const { name_ar, name_en, contact_person, phone, email, address, is_active, notes } = req.body;
  if (name_ar !== undefined) company.name_ar = name_ar;
  if (name_en !== undefined) company.name_en = name_en;
  if (contact_person !== undefined) company.contact_person = contact_person;
  if (phone !== undefined) company.phone = phone;
  if (email !== undefined) company.email = email;
  if (address !== undefined) company.address = address;
  if (is_active !== undefined) company.is_active = is_active;
  if (notes !== undefined) company.notes = notes;
  await company.save();
  res.json(company);
});

// PUT /api/insurance-companies/:id/regenerate-key - توليد مفتاح API جديد (يُبطل القديم فورًا) - admin فقط
router.put('/:id/regenerate-key', authorize('admin'), async (req, res) => {
  const company = await InsuranceCompany.findByPk(req.params.id);
  if (!company) return res.status(404).json({ message: 'الشركة غير موجودة' });

  company.api_key = crypto.randomBytes(24).toString('hex');
  await company.save();
  await logAudit({
    req, action: 'update', entityType: 'InsuranceCompany', entityId: company.id,
    description: `توليد مفتاح API جديد لشركة "${company.name_ar}" (إبطال المفتاح السابق)`,
  });
  res.json(company);
});

module.exports = router;

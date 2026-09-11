const express = require('express');
const { InventoryItem } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// يولّد باركودًا رقميًا فريدًا من 12 رقمًا لم يُستخدم من قبل
async function generateUniqueBarcode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = String(Date.now()).slice(-6) + String(Math.floor(100000 + Math.random() * 900000));
    // eslint-disable-next-line no-await-in-loop
    const exists = await InventoryItem.findOne({ where: { barcode: candidate } });
    if (!exists) return candidate;
  }
  throw new Error('تعذر توليد باركود فريد');
}

// GET /api/inventory - متاح لكل المستخدمين المسجلين (عرض فقط لغير المخوّلين بالتعديل)
router.get('/', async (req, res) => {
  const items = await InventoryItem.findAll({ order: [['name', 'ASC']] });
  res.json(items);
});

// GET /api/inventory/barcode/:code - البحث عن صنف بالباركود (لأغراض المسح السريع)
router.get('/barcode/:code', async (req, res) => {
  const item = await InventoryItem.findOne({ where: { barcode: req.params.code } });
  if (!item) return res.status(404).json({ message: 'لا يوجد صنف بهذا الباركود' });
  res.json(item);
});

// من هنا فصاعدًا: التعديل الكامل (توريد/صرف عبر مسح، إضافة/حذف/تعديل الكمية) لـ admin و pharmacy فقط
router.post('/scan-adjust', authorize('admin', 'pharmacy'), async (req, res) => {
  const { barcode, delta } = req.body;
  const item = await InventoryItem.findOne({ where: { barcode } });
  if (!item) return res.status(404).json({ message: 'لا يوجد صنف بهذا الباركود' });

  const change = Number(delta) || 0;
  const newQuantity = item.quantity + change;
  if (newQuantity < 0) {
    return res.status(400).json({ message: 'لا يمكن أن تكون الكمية أقل من صفر' });
  }
  item.quantity = newQuantity;
  await item.save();
  res.json(item);
});

// PUT /api/inventory/:id/price - تعديل سعر الوحدة فقط (admin والمحاسبة billing)
router.put('/:id/price', authorize('admin', 'billing'), async (req, res) => {
  const item = await InventoryItem.findByPk(req.params.id);
  if (!item) return res.status(404).json({ message: 'الصنف غير موجود' });

  const { unit_price } = req.body;
  if (unit_price === undefined || Number(unit_price) < 0) {
    return res.status(400).json({ message: 'سعر غير صالح' });
  }
  item.unit_price = unit_price;
  await item.save();
  res.json(item);
});

// من هنا فصاعدًا: التعديل الكامل (إضافة/حذف/تعديل الكمية) مسموح فقط لـ admin و pharmacy
router.use(authorize('admin', 'pharmacy'));

// POST /api/inventory - إضافة صنف جديد (يولّد باركودًا تلقائيًا إن لم يُدخَل واحد)
router.post('/', async (req, res) => {
  const { name, category, unit, quantity, min_stock, unit_price, expiry_date, notes, barcode } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'اسم الصنف مطلوب' });
  }

  try {
    const finalBarcode = barcode && barcode.trim() ? barcode.trim() : await generateUniqueBarcode();
    const item = await InventoryItem.create({
      name,
      category,
      unit,
      quantity,
      min_stock,
      unit_price,
      expiry_date: expiry_date || null,
      notes,
      barcode: finalBarcode,
    });
    res.status(201).json(item);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'هذا الباركود مستخدم مسبقًا لصنف آخر' });
    }
    res.status(500).json({ message: 'حدث خطأ أثناء إضافة الصنف' });
  }
});

// PUT /api/inventory/:id - تعديل صنف (بيانات عامة أو تعديل الكمية أو الباركود)
router.put('/:id', async (req, res) => {
  const item = await InventoryItem.findByPk(req.params.id);
  if (!item) return res.status(404).json({ message: 'الصنف غير موجود' });

  const fields = ['name', 'category', 'unit', 'quantity', 'min_stock', 'unit_price', 'expiry_date', 'notes', 'barcode'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) item[f] = req.body[f];
  });

  try {
    await item.save();
    res.json(item);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'هذا الباركود مستخدم مسبقًا لصنف آخر' });
    }
    res.status(500).json({ message: 'حدث خطأ أثناء تعديل الصنف' });
  }
});

// POST /api/inventory/:id/adjust - إضافة أو سحب كمية من المخزون (توريد/صرف يدوي بدون مسح)
router.post('/:id/adjust', async (req, res) => {
  const item = await InventoryItem.findByPk(req.params.id);
  if (!item) return res.status(404).json({ message: 'الصنف غير موجود' });

  const delta = Number(req.body.delta) || 0;
  const newQuantity = item.quantity + delta;
  if (newQuantity < 0) {
    return res.status(400).json({ message: 'لا يمكن أن تكون الكمية أقل من صفر' });
  }
  item.quantity = newQuantity;
  await item.save();
  res.json(item);
});

// POST /api/inventory/:id/barcode - توليد باركود جديد لصنف (إن كان بدون باركود أو لإعادة توليده)
router.post('/:id/barcode', async (req, res) => {
  const item = await InventoryItem.findByPk(req.params.id);
  if (!item) return res.status(404).json({ message: 'الصنف غير موجود' });

  item.barcode = await generateUniqueBarcode();
  await item.save();
  res.json(item);
});

// DELETE /api/inventory/:id - حذف صنف
router.delete('/:id', async (req, res) => {
  await InventoryItem.destroy({ where: { id: req.params.id } });
  res.json({ message: 'تم حذف الصنف' });
});

module.exports = router;

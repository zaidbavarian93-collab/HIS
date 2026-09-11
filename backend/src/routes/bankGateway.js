const express = require('express');
const crypto = require('crypto');
const { BankGatewayTransaction, InstallmentPayment, InstallmentPlan, Invoice, Patient, SystemSetting } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { postJournalEntry, ACCOUNT_CODES } = require('../services/accounting');
const { logAudit } = require('../services/auditLog');

const router = express.Router();

// بوابة مصرفية خارجية - نموذج توضيحي (Reference Implementation) باسم "مصرف الرافدين" يوضّح كيف
// يمكن لأي بنك عراقي حقيقي أن يتكامل مع منصة الأقساط عبر مفتاح API + نقطة webhook. لا يوجد تعاقد
// فعلي حاليًا مع مصرف الرافدين أو أي بنك آخر - هذا هيكل جاهز للربط الفعلي فور توفر تعاقد وبيانات
// اعتماد حقيقية من البنك (لا تُستخدم هذه الصفحة كادّعاء بوجود تكامل مصرفي حقيقي قائم).
const BANK_CONFIG_KEY = 'bank_gateway_rafidain';

async function getOrCreateBankConfig() {
  let setting = await SystemSetting.findByPk(BANK_CONFIG_KEY);
  if (!setting) {
    setting = await SystemSetting.create({
      key: BANK_CONFIG_KEY,
      value: {
        bank_name_ar: 'مصرف الرافدين',
        bank_name_en: 'Al-Rafidain Bank',
        hospital_account_number: 'IQ00RAFB000000000000000 (نموذج تجريبي)',
        api_key: crypto.randomBytes(24).toString('hex'),
        is_active: true,
      },
    });
  }
  return setting;
}

async function generateReferenceNumber() {
  const year = new Date().getFullYear();
  const count = await BankGatewayTransaction.count();
  return `RAF-${year}-${String(count + 1).padStart(6, '0')}`;
}

// ينفّذ تأكيد الدفع فعليًا (يُستدعى من webhook البنك الحقيقي أو من زر المحاكاة على حد سواء)
async function confirmTransaction({ reference_number, bank_transaction_id, simulated, reqForAudit }) {
  const txn = await BankGatewayTransaction.findOne({
    where: { reference_number },
    include: [{ model: InstallmentPayment, include: [{ model: InstallmentPlan, as: 'plan', include: [{ model: Invoice }, { model: Patient, attributes: ['full_name'] }] }] }],
  });
  if (!txn) throw Object.assign(new Error('رقم مرجعي غير موجود'), { status: 404 });
  if (txn.status === 'confirmed') return txn; // متكرر - لا يُعاد ترحيل القيد

  txn.status = 'confirmed';
  txn.bank_transaction_id = bank_transaction_id || null;
  txn.simulated = simulated;
  txn.confirmed_at = new Date();
  await txn.save();

  const payment = txn.InstallmentPayment;
  payment.status = 'paid';
  payment.paid_at = new Date();
  await payment.save();

  try {
    await postJournalEntry({
      description: `تحصيل قسط رقم ${payment.installment_number} عبر ${txn.bank_name} - مرجع ${txn.reference_number}`,
      referenceType: 'invoice', referenceId: payment.plan.invoice_id,
      lines: [
        { code: ACCOUNT_CODES.BANK, debit: Number(payment.amount), credit: 0 },
        { code: ACCOUNT_CODES.PATIENT_RECEIVABLE, debit: 0, credit: Number(payment.amount) },
      ],
    });
  } catch (err) {
    console.error('تعذّر ترحيل قيد التحصيل المصرفي:', err.message);
  }

  const allPayments = await InstallmentPayment.findAll({ where: { installment_plan_id: payment.installment_plan_id } });
  const allPaid = allPayments.every((p) => p.status === 'paid');
  if (allPaid) {
    await InstallmentPlan.update({ status: 'completed' }, { where: { id: payment.installment_plan_id } });
    await Invoice.update({ status: 'paid', paid_at: new Date() }, { where: { id: payment.plan.invoice_id } });
  }

  await logAudit({
    req: reqForAudit, action: 'pay', entityType: 'BankGatewayTransaction', entityId: txn.id,
    description: `تأكيد ${txn.bank_name} لتحصيل قسط رقم ${payment.installment_number} من ${payment.plan.Patient?.full_name} - ${Number(payment.amount).toLocaleString('en-US')} (مرجع ${txn.reference_number})${simulated ? ' [محاكاة]' : ''}${allPaid ? ' - اكتملت الخطة' : ''}`,
    after: { reference_number: txn.reference_number, amount: payment.amount, simulated },
  });

  return txn;
}

// ===== نقاط النهاية الداخلية (تتطلب تسجيل دخول موظف) =====
router.use('/config', authenticate, authorize('admin', 'billing'));
router.use('/initiate', authenticate, authorize('admin', 'billing'));
router.use('/simulate-confirm', authenticate, authorize('admin', 'billing'));
router.use('/transactions', authenticate, authorize('admin', 'billing'));

// GET /api/bank-gateway/config - إعدادات البوابة (مفتاح API مموَّه جزئيًا)
router.get('/config', async (req, res) => {
  const setting = await getOrCreateBankConfig();
  const { api_key, ...rest } = setting.value;
  res.json({ ...rest, api_key_masked: `${api_key.slice(0, 8)}${'•'.repeat(16)}`, api_key_full: req.user.role === 'admin' ? api_key : undefined });
});

// PUT /api/bank-gateway/config/regenerate-key - توليد مفتاح API جديد (admin فقط)
router.put('/config/regenerate-key', authorize('admin'), async (req, res) => {
  const setting = await getOrCreateBankConfig();
  const newKey = crypto.randomBytes(24).toString('hex');
  setting.value = { ...setting.value, api_key: newKey };
  await setting.save();
  await logAudit({ req, action: 'update', entityType: 'BankGatewayConfig', description: 'توليد مفتاح API جديد لبوابة مصرف الرافدين' });
  res.json({ api_key: newKey });
});

// GET /api/bank-gateway/transactions - سجل كل معاملات البوابة المصرفية
router.get('/transactions', async (req, res) => {
  const txns = await BankGatewayTransaction.findAll({
    include: [{ model: InstallmentPayment, include: [{ model: InstallmentPlan, as: 'plan', include: [{ model: Patient, attributes: ['full_name'] }] }] }],
    order: [['initiated_at', 'DESC']],
  });
  res.json(txns);
});

// POST /api/bank-gateway/initiate/:installmentPaymentId - طلب دفع قسط عبر البنك (يُنشئ رقمًا مرجعيًا
// يُقدَّم للمريض ليدفعه في أي فرع لمصرف الرافدين أو عبر تطبيقه، ثم ينتظر تأكيد البنك عبر webhook)
router.post('/initiate/:installmentPaymentId', async (req, res) => {
  const payment = await InstallmentPayment.findByPk(req.params.installmentPaymentId);
  if (!payment) return res.status(404).json({ message: 'القسط غير موجود' });
  if (payment.status === 'paid') return res.status(400).json({ message: 'تم تحصيل هذا القسط مسبقًا' });

  const existing = await BankGatewayTransaction.findOne({ where: { installment_payment_id: payment.id, status: 'initiated' } });
  if (existing) return res.status(200).json(existing);

  const config = await getOrCreateBankConfig();
  const txn = await BankGatewayTransaction.create({
    reference_number: await generateReferenceNumber(),
    bank_name: config.value.bank_name_ar,
    installment_payment_id: payment.id,
    amount: payment.amount,
    status: 'initiated',
  });

  await logAudit({
    req, action: 'create', entityType: 'BankGatewayTransaction', entityId: txn.id,
    description: `طلب تحصيل قسط عبر ${txn.bank_name} - مرجع ${txn.reference_number} بمبلغ ${Number(payment.amount).toLocaleString('en-US')}`,
  });

  res.status(201).json(txn);
});

// POST /api/bank-gateway/simulate-confirm/:reference_number - محاكاة تأكيد البنك (admin/billing فقط)
// للعرض التجريبي فقط بغياب تعاقد فعلي - في بيئة إنتاج حقيقية يستدعي البنك /webhook تلقائيًا بدل هذا
router.post('/simulate-confirm/:reference_number', async (req, res) => {
  try {
    const txn = await confirmTransaction({
      reference_number: req.params.reference_number,
      bank_transaction_id: `SIM-${Date.now()}`,
      simulated: true,
      reqForAudit: req,
    });
    res.json(txn);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message || 'تعذّر تأكيد المعاملة' });
  }
});

// ===== نقطة النهاية الخارجية الحقيقية (يستدعيها نظام البنك نفسه) =====
// POST /api/bank-gateway/webhook - مصادقة بمفتاح API الخاص بالبوابة (X-Api-Key) لا بحساب مستخدم
router.post('/webhook', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const config = await getOrCreateBankConfig();
  if (!apiKey || apiKey !== config.value.api_key || !config.value.is_active) {
    return res.status(401).json({ message: 'مفتاح API غير صالح' });
  }

  const { reference_number, status, bank_transaction_id } = req.body;
  if (!reference_number || !status) return res.status(400).json({ message: 'reference_number وstatus مطلوبان' });

  try {
    if (status === 'failed') {
      await BankGatewayTransaction.update(
        { status: 'failed', bank_transaction_id, raw_callback: req.body },
        { where: { reference_number } }
      );
      return res.json({ message: 'تم تسجيل فشل العملية' });
    }
    const txn = await confirmTransaction({ reference_number, bank_transaction_id, simulated: false, reqForAudit: null });
    res.json({ message: 'تم تأكيد الدفع وترحيله محاسبيًا', reference_number: txn.reference_number });
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message || 'تعذّر تأكيد المعاملة' });
  }
});

module.exports = router;

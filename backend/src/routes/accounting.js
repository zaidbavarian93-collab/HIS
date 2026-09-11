const express = require('express');
const { Op } = require('sequelize');
const { Account, JournalEntry, JournalEntryLine, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { postJournalEntry } = require('../services/accounting');
const { logAudit } = require('../services/auditLog');

const router = express.Router();

router.use(authenticate, authorize('admin', 'billing'));

// GET /api/accounting/accounts - شجرة الحسابات كاملة مع رصيد كل حساب (محسوب من كل القيود المرحّلة)
router.get('/accounts', async (req, res) => {
  const accounts = await Account.findAll({ order: [['code', 'ASC']] });

  const balances = await JournalEntryLine.findAll({
    attributes: [
      'account_id',
      [JournalEntryLine.sequelize.fn('SUM', JournalEntryLine.sequelize.col('debit')), 'total_debit'],
      [JournalEntryLine.sequelize.fn('SUM', JournalEntryLine.sequelize.col('credit')), 'total_credit'],
    ],
    group: ['account_id'],
    raw: true,
  });
  const balanceByAccount = {};
  balances.forEach((b) => {
    balanceByAccount[b.account_id] = { debit: Number(b.total_debit), credit: Number(b.total_credit) };
  });

  const accountsWithBalance = accounts.map((a) => {
    const bal = balanceByAccount[a.id] || { debit: 0, credit: 0 };
    // الرصيد الفعلي يُحسب حسب الطبيعة الدائنة/المدينة للحساب (مدين - دائن للحسابات المدينة والعكس للدائنة)
    const balance = a.normal_balance === 'debit' ? bal.debit - bal.credit : bal.credit - bal.debit;
    return { ...a.toJSON(), total_debit: bal.debit, total_credit: bal.credit, balance };
  });

  res.json(accountsWithBalance);
});

// GET /api/accounting/accounts/:id/ledger - دفتر أستاذ حساب معيّن (كل الحركات مرتّبة زمنيًا)
router.get('/accounts/:id/ledger', async (req, res) => {
  const account = await Account.findByPk(req.params.id);
  if (!account) return res.status(404).json({ message: 'الحساب غير موجود' });

  const lines = await JournalEntryLine.findAll({
    where: { account_id: req.params.id },
    include: [{ model: JournalEntry, attributes: ['entry_number', 'entry_date', 'description', 'reference_type'] }],
    order: [[{ model: JournalEntry }, 'entry_date', 'ASC']],
  });

  let running = 0;
  const rows = lines.map((l) => {
    const delta = account.normal_balance === 'debit' ? Number(l.debit) - Number(l.credit) : Number(l.credit) - Number(l.debit);
    running += delta;
    return {
      entry_number: l.JournalEntry.entry_number,
      entry_date: l.JournalEntry.entry_date,
      description: l.description || l.JournalEntry.description,
      reference_type: l.JournalEntry.reference_type,
      debit: Number(l.debit),
      credit: Number(l.credit),
      running_balance: running,
    };
  });

  res.json({ account, entries: rows });
});

// GET /api/accounting/journal-entries?from=&to=&reference_type= - سجل القيود اليومية
router.get('/journal-entries', async (req, res) => {
  const { from, to, reference_type } = req.query;
  const where = {};
  if (from && to) where.entry_date = { [Op.between]: [from, to] };
  if (reference_type) where.reference_type = reference_type;

  const entries = await JournalEntry.findAll({
    where,
    include: [
      { model: JournalEntryLine, as: 'lines', include: [{ model: Account, attributes: ['code', 'name_ar'] }] },
      { model: User, as: 'creator', attributes: ['id', 'full_name'] },
    ],
    order: [['entry_date', 'DESC'], ['created_at', 'DESC']],
  });
  res.json(entries);
});

// POST /api/accounting/journal-entries - قيد يدوي (تسوية، مصاريف عامة، تحصيل تأمين من الشركة...)
router.post('/journal-entries', async (req, res) => {
  const { description, date, lines } = req.body;
  if (!description || !Array.isArray(lines) || lines.length < 2) {
    return res.status(400).json({ message: 'الوصف وسطرين على الأقل مطلوبان' });
  }

  try {
    const entry = await postJournalEntry({
      description,
      referenceType: 'manual',
      lines,
      userId: req.user.id,
      date,
    });
    if (!entry) return res.status(400).json({ message: 'قيمة القيد صفرية - لم يُرحَّل' });
    await logAudit({
      req, action: 'create', entityType: 'JournalEntry', entityId: entry.id,
      description: `قيد يدوي: ${description} - المبلغ ${Number(entry.total_amount).toLocaleString('en-US')}`,
      after: { description, lines, total_amount: entry.total_amount },
    });
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ message: err.message || 'تعذّر ترحيل القيد' });
  }
});

// دالة مساعدة: تجمع مدين/دائن كل حساب ضمن شرط تاريخ معيّن (أو بلا شرط)
async function sumLinesByAccount(dateWhere) {
  const lines = await JournalEntryLine.findAll({
    attributes: [
      'account_id',
      [JournalEntryLine.sequelize.fn('SUM', JournalEntryLine.sequelize.col('debit')), 'total_debit'],
      [JournalEntryLine.sequelize.fn('SUM', JournalEntryLine.sequelize.col('credit')), 'total_credit'],
    ],
    include: [{ model: JournalEntry, attributes: [], where: dateWhere }],
    group: ['account_id'],
    raw: true,
  });
  const map = {};
  lines.forEach((l) => {
    map[l.account_id] = { debit: Number(l.total_debit), credit: Number(l.total_credit) };
  });
  return map;
}

// GET /api/accounting/trial-balance?from=&to= - ميزان المراجعة للفترة (رصيد افتتاحي + حركة الفترة + رصيد ختامي)
router.get('/trial-balance', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ message: 'يجب تحديد تاريخ البداية والنهاية' });

  const accounts = await Account.findAll({ where: { is_group: false }, order: [['code', 'ASC']] });
  const opening = await sumLinesByAccount({ entry_date: { [Op.lt]: from } });
  const period = await sumLinesByAccount({ entry_date: { [Op.between]: [from, to] } });

  let totalPeriodDebit = 0;
  let totalPeriodCredit = 0;
  let totalOpening = 0;
  let totalClosing = 0;

  const rows = accounts.map((a) => {
    const o = opening[a.id] || { debit: 0, credit: 0 };
    const p = period[a.id] || { debit: 0, credit: 0 };
    const sign = a.normal_balance === 'debit' ? 1 : -1;
    const openingBalance = sign * (o.debit - o.credit);
    const closingBalance = sign * (o.debit + p.debit - o.credit - p.credit);

    totalPeriodDebit += p.debit;
    totalPeriodCredit += p.credit;
    totalOpening += openingBalance;
    totalClosing += closingBalance;

    return {
      code: a.code,
      name_ar: a.name_ar,
      type: a.type,
      opening_balance: openingBalance,
      period_debit: p.debit,
      period_credit: p.credit,
      closing_balance: closingBalance,
    };
  }).filter((r) => r.opening_balance !== 0 || r.period_debit !== 0 || r.period_credit !== 0 || r.closing_balance !== 0);

  res.json({
    from,
    to,
    rows,
    totals: {
      opening_balance: totalOpening,
      period_debit: totalPeriodDebit,
      period_credit: totalPeriodCredit,
      closing_balance: totalClosing,
    },
    is_balanced: Math.abs(totalPeriodDebit - totalPeriodCredit) < 0.01,
  });
});

// GET /api/accounting/income-statement?from=&to= - قائمة الدخل عن الفترة (الإيرادات - المصروفات)
router.get('/income-statement', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ message: 'يجب تحديد تاريخ البداية والنهاية' });

  const accounts = await Account.findAll({
    where: { is_group: false, type: ['revenue', 'expense'] },
    order: [['code', 'ASC']],
  });
  const period = await sumLinesByAccount({ entry_date: { [Op.between]: [from, to] } });

  let totalRevenue = 0;
  let totalExpense = 0;
  const revenueRows = [];
  const expenseRows = [];

  accounts.forEach((a) => {
    const p = period[a.id] || { debit: 0, credit: 0 };
    if (a.type === 'revenue') {
      const amount = p.credit - p.debit;
      if (amount !== 0) revenueRows.push({ code: a.code, name_ar: a.name_ar, amount });
      totalRevenue += amount;
    } else {
      const amount = p.debit - p.credit;
      if (amount !== 0) expenseRows.push({ code: a.code, name_ar: a.name_ar, amount });
      totalExpense += amount;
    }
  });

  res.json({
    from,
    to,
    revenue: revenueRows,
    expense: expenseRows,
    total_revenue: totalRevenue,
    total_expense: totalExpense,
    net_result: totalRevenue - totalExpense,
  });
});

// GET /api/accounting/balance-sheet?asOf= - قائمة المركز المالي (الميزانية العمومية) حتى تاريخ معيّن
router.get('/balance-sheet', async (req, res) => {
  const asOf = req.query.asOf || new Date().toISOString().slice(0, 10);

  const accounts = await Account.findAll({
    where: { is_group: false, type: ['asset', 'liability', 'equity', 'revenue', 'expense'] },
    order: [['code', 'ASC']],
  });
  const cumulative = await sumLinesByAccount({ entry_date: { [Op.lte]: asOf } });

  const assetRows = [];
  const liabilityRows = [];
  const equityRows = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let totalRevenue = 0;
  let totalExpense = 0;

  accounts.forEach((a) => {
    const c = cumulative[a.id] || { debit: 0, credit: 0 };
    if (a.type === 'asset') {
      const amount = c.debit - c.credit;
      if (amount !== 0) assetRows.push({ code: a.code, name_ar: a.name_ar, amount });
      totalAssets += amount;
    } else if (a.type === 'liability') {
      const amount = c.credit - c.debit;
      if (amount !== 0) liabilityRows.push({ code: a.code, name_ar: a.name_ar, amount });
      totalLiabilities += amount;
    } else if (a.type === 'equity') {
      const amount = c.credit - c.debit;
      if (amount !== 0) equityRows.push({ code: a.code, name_ar: a.name_ar, amount });
      totalEquity += amount;
    } else if (a.type === 'revenue') {
      totalRevenue += c.credit - c.debit;
    } else if (a.type === 'expense') {
      totalExpense += c.debit - c.credit;
    }
  });

  // نتيجة الأعمال المتراكمة (أرباح/خسائر) حتى تاريخ الميزانية تُضاف لحقوق الملكية تلقائيًا
  // حتى تتوازن المعادلة المحاسبية (الأصول = الخصوم + حقوق الملكية) دون الحاجة لقيد إقفال يدوي
  const netResult = totalRevenue - totalExpense;
  if (netResult !== 0) {
    equityRows.push({ code: '—', name_ar: 'نتيجة الأعمال المتراكمة (أرباح/خسائر)', amount: netResult });
    totalEquity += netResult;
  }

  res.json({
    as_of: asOf,
    assets: assetRows,
    liabilities: liabilityRows,
    equity: equityRows,
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    total_equity: totalEquity,
    is_balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  });
});

module.exports = router;

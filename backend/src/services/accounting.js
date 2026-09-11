const { Account, JournalEntry, JournalEntryLine } = require('../models');

// رموز الحسابات المرتبطة تلقائيًا بعمليات النظام - يجب أن تطابق الرموز المزروعة في seed.js
const ACCOUNT_CODES = {
  CASH: '111',
  BANK: '112',
  PATIENT_RECEIVABLE: '113',
  INSURANCE_RECEIVABLE: '114',
  SALARIES_PAYABLE: '212',
  SOCIAL_SECURITY_PAYABLE: '213',
  INCOME_TAX_PAYABLE: '214',
  MEDICAL_SERVICES_REVENUE: '41',
  INSURANCE_PREMIUM_REVENUE: '43',
  SALARIES_EXPENSE: '51',
};

async function generateEntryNumber() {
  const year = new Date().getFullYear();
  const count = await JournalEntry.count();
  const serial = String(count + 1).padStart(6, '0');
  return `JE-${year}-${serial}`;
}

// يُنشئ قيد يومية متوازن (مجموع المدين = مجموع الدائن) من مجموعة أسطر بصيغة { code, debit, credit, description }
// ويُرحَّل تلقائيًا فور الإنشاء (لا يوجد مفهوم مسودة في هذا الإصدار)
async function postJournalEntry({ description, referenceType, referenceId, lines, userId, date }) {
  const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);

  if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
    throw new Error(`القيد غير متوازن: مدين ${totalDebit} لا يساوي دائن ${totalCredit}`);
  }
  if (totalDebit === 0) return null; // لا داعي لترحيل قيد بقيمة صفرية

  const codes = [...new Set(lines.filter((l) => l.code).map((l) => l.code))];
  const accounts = codes.length > 0 ? await Account.findAll({ where: { code: codes } }) : [];
  const accountByCode = {};
  accounts.forEach((a) => { accountByCode[a.code] = a; });

  const entry_number = await generateEntryNumber();
  const entry = await JournalEntry.create({
    entry_number,
    entry_date: date || new Date().toISOString().slice(0, 10),
    description,
    reference_type: referenceType,
    reference_id: referenceId || null,
    total_amount: totalDebit,
    created_by: userId || null,
  });

  await JournalEntryLine.bulkCreate(
    lines
      .filter((l) => Number(l.debit || 0) > 0 || Number(l.credit || 0) > 0)
      .map((l) => {
        const accountId = l.account_id || accountByCode[l.code]?.id;
        if (!accountId) throw new Error(`حساب غير موجود (${l.code || l.account_id}) - راجع شجرة الحسابات`);
        return {
          journal_entry_id: entry.id,
          account_id: accountId,
          debit: l.debit || 0,
          credit: l.credit || 0,
          description: l.description || description,
        };
      })
  );

  return entry;
}

module.exports = { postJournalEntry, ACCOUNT_CODES };

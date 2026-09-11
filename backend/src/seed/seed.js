require('dotenv').config();
const { sequelize, User, Department, DepartmentCategory, InsurancePlan, Account } = require('../models');

async function seed() {
  await sequelize.sync();

  // إنشاء حساب المدير الأول إن لم يكن موجودًا
  const existingAdmin = await User.findOne({ where: { username: 'admin' } });
  if (!existingAdmin) {
    await User.create({
      full_name: 'مدير النظام',
      username: 'admin',
      password_hash: 'ChangeMe123!', // غيّرها فورًا بعد أول تسجيل دخول
      role: 'admin',
    });
    console.log('تم إنشاء حساب المدير: admin / ChangeMe123!  (غيّر كلمة المرور فورًا)');
  } else {
    console.log('حساب المدير موجود مسبقًا');
  }

  // أقسام أولية شائعة - عدّلها لاحقًا من لوحة التحكم
  const defaultDepartments = [
    { name_ar: 'الطوارئ', name_en: 'Emergency', type: 'inpatient', consultation_fee: 0 },
    { name_ar: 'الباطنية', name_en: 'Internal Medicine', type: 'outpatient', consultation_fee: 15000 },
    { name_ar: 'الجراحة العامة', name_en: 'General Surgery', type: 'outpatient', consultation_fee: 20000 },
    { name_ar: 'النسائية والتوليد', name_en: 'Obstetrics & Gynecology', type: 'outpatient', consultation_fee: 20000 },
    { name_ar: 'الأطفال', name_en: 'Pediatrics', type: 'outpatient', consultation_fee: 15000 },
    { name_ar: 'المختبر', name_en: 'Laboratory', type: 'service', consultation_fee: 0 },
    { name_ar: 'الصيدلية', name_en: 'Pharmacy', type: 'service', consultation_fee: 0 },
    { name_ar: 'الأشعة', name_en: 'Radiology', type: 'service', consultation_fee: 0 },
  ];

  // فئات فرعية افتراضية لكل قسم (تخصصات داخل القسم)
  const defaultCategories = {
    'Internal Medicine': [
      { name_ar: 'قلبية', name_en: 'Cardiology' },
      { name_ar: 'غدد صماء وسكري', name_en: 'Endocrinology' },
      { name_ar: 'جهاز هضمي', name_en: 'Gastroenterology' },
      { name_ar: 'كلى', name_en: 'Nephrology' },
    ],
    'General Surgery': [
      { name_ar: 'جراحة عامة', name_en: 'General' },
      { name_ar: 'جراحة عظام', name_en: 'Orthopedics' },
      { name_ar: 'جراحة مسالك بولية', name_en: 'Urology' },
    ],
    'Obstetrics & Gynecology': [
      { name_ar: 'توليد', name_en: 'Obstetrics' },
      { name_ar: 'أمراض نسائية', name_en: 'Gynecology' },
      { name_ar: 'عقم وخصوبة', name_en: 'Fertility' },
    ],
    Pediatrics: [
      { name_ar: 'حديثي الولادة', name_en: 'Neonatology' },
      { name_ar: 'أطفال عام', name_en: 'General Pediatrics' },
    ],
    Emergency: [
      { name_ar: 'طوارئ عام', name_en: 'General Emergency' },
      { name_ar: 'إصابات وحوادث', name_en: 'Trauma' },
    ],
    Laboratory: [
      { name_ar: 'تحاليل دم', name_en: 'Hematology' },
      { name_ar: 'كيمياء حيوية', name_en: 'Biochemistry' },
      { name_ar: 'أحياء دقيقة', name_en: 'Microbiology' },
    ],
    Pharmacy: [
      { name_ar: 'صيدلية داخلية', name_en: 'Inpatient Pharmacy' },
      { name_ar: 'صيدلية خارجية', name_en: 'Outpatient Pharmacy' },
    ],
    Radiology: [
      { name_ar: 'أشعة عادية', name_en: 'X-Ray' },
      { name_ar: 'أشعة مقطعية ورنين', name_en: 'CT & MRI' },
      { name_ar: 'سونار', name_en: 'Ultrasound' },
    ],
  };

  for (const dept of defaultDepartments) {
    const [record, created] = await Department.findOrCreate({
      where: { name_en: dept.name_en },
      defaults: dept,
    });
    if (created) console.log(`تمت إضافة قسم: ${dept.name_ar}`);

    const categories = defaultCategories[dept.name_en] || [];
    for (const cat of categories) {
      const [, catCreated] = await DepartmentCategory.findOrCreate({
        where: { department_id: record.id, name_en: cat.name_en },
        defaults: { ...cat, department_id: record.id },
      });
      if (catCreated) console.log(`  - فئة: ${cat.name_ar} (${dept.name_ar})`);
    }
  }

  // خطط التأمين الصحي الافتراضية - مستوحاة من نموذج التأمين الصحي الوطني الكوري الجنوبي (NHIS):
  // اشتراك شامل بنسب تغطية عالية وسقف سنوي يحمي من الفواتير الكارثية
  const defaultInsurancePlans = [
    {
      name_ar: 'خطة المواطن الأساسية',
      name_en: 'Citizen Basic Plan',
      category: 'citizen',
      coverage_percentage: 70,
      monthly_premium: 15000,
      annual_max_coverage: 10000000,
      description_ar: 'تغطية 70% من تكاليف العلاج لكل المواطنين، بسقف سنوي يحمي من الفواتير الكارثية.',
    },
    {
      name_ar: 'خطة كادر المستشفى',
      name_en: 'Hospital Staff Plan',
      category: 'staff',
      coverage_percentage: 90,
      monthly_premium: 0,
      annual_max_coverage: null,
      description_ar: 'تغطية 90% بدون بدل شهري، كمزية عمل لكل منتسبي المستشفى - بدون سقف تغطية سنوي.',
    },
    {
      name_ar: 'خطة مقربي الكادر (الدرجة الأولى)',
      name_en: 'Staff First-Degree Relatives Plan',
      category: 'dependent',
      coverage_percentage: 80,
      monthly_premium: 5000,
      annual_max_coverage: 15000000,
      description_ar: 'للزوج/الزوجة والأبناء والوالدين لأحد منتسبي المستشفى - تغطية 80% ببدل رمزي.',
    },
  ];

  for (const plan of defaultInsurancePlans) {
    const [, created] = await InsurancePlan.findOrCreate({
      where: { name_en: plan.name_en },
      defaults: plan,
    });
    if (created) console.log(`تمت إضافة خطة تأمين: ${plan.name_ar}`);
  }

  // شجرة الحسابات (دليل الحسابات) - وفق تصنيف النظام المحاسبي الموحد العراقي:
  // 1 الأصول | 2 الخصوم | 3 حقوق الملكية | 4 الإيرادات | 5 المصروفات
  // كل حساب فرعي (is_group=false) هو ما تُرحَّل إليه القيود مباشرة؛ الحسابات التجميعية للعرض الهرمي فقط
  const coaTree = [
    {
      code: '1', name_ar: 'الأصول', name_en: 'Assets', type: 'asset', normal_balance: 'debit', is_group: true,
      children: [
        {
          code: '11', name_ar: 'الأصول المتداولة', name_en: 'Current Assets', type: 'asset', normal_balance: 'debit', is_group: true,
          children: [
            { code: '111', name_ar: 'الصندوق', name_en: 'Cash', type: 'asset', normal_balance: 'debit' },
            { code: '112', name_ar: 'البنك', name_en: 'Bank', type: 'asset', normal_balance: 'debit' },
            { code: '113', name_ar: 'ذمم المرضى المدينة', name_en: 'Patient Receivables', type: 'asset', normal_balance: 'debit' },
            { code: '114', name_ar: 'ذمم التأمين الصحي المدينة', name_en: 'Insurance Receivables', type: 'asset', normal_balance: 'debit' },
            { code: '115', name_ar: 'مخزون الأدوية', name_en: 'Medicine Inventory', type: 'asset', normal_balance: 'debit' },
            { code: '116', name_ar: 'مخزون المستلزمات الطبية', name_en: 'Medical Supplies Inventory', type: 'asset', normal_balance: 'debit' },
          ],
        },
        {
          code: '12', name_ar: 'الأصول الثابتة', name_en: 'Fixed Assets', type: 'asset', normal_balance: 'debit', is_group: true,
          children: [
            { code: '121', name_ar: 'الأجهزة والمعدات الطبية', name_en: 'Medical Equipment', type: 'asset', normal_balance: 'debit' },
            { code: '122', name_ar: 'مجمّع إهلاك المعدات', name_en: 'Accumulated Depreciation', type: 'asset', normal_balance: 'credit' },
          ],
        },
      ],
    },
    {
      code: '2', name_ar: 'الخصوم', name_en: 'Liabilities', type: 'liability', normal_balance: 'credit', is_group: true,
      children: [
        {
          code: '21', name_ar: 'الخصوم المتداولة', name_en: 'Current Liabilities', type: 'liability', normal_balance: 'credit', is_group: true,
          children: [
            { code: '211', name_ar: 'ذمم دائنة - موردون', name_en: 'Accounts Payable - Suppliers', type: 'liability', normal_balance: 'credit' },
            { code: '212', name_ar: 'رواتب مستحقة الدفع', name_en: 'Salaries Payable', type: 'liability', normal_balance: 'credit' },
            { code: '213', name_ar: 'استقطاعات الضمان الاجتماعي المستحقة', name_en: 'Social Security Payable', type: 'liability', normal_balance: 'credit' },
            { code: '214', name_ar: 'ضريبة الدخل المستحقة', name_en: 'Income Tax Payable', type: 'liability', normal_balance: 'credit' },
            { code: '215', name_ar: 'مطالبات تأمين مستحقة الدفع', name_en: 'Insurance Claims Payable', type: 'liability', normal_balance: 'credit' },
          ],
        },
      ],
    },
    {
      code: '3', name_ar: 'حقوق الملكية', name_en: 'Equity', type: 'equity', normal_balance: 'credit', is_group: true,
      children: [
        { code: '31', name_ar: 'رأس المال', name_en: 'Capital', type: 'equity', normal_balance: 'credit' },
        { code: '32', name_ar: 'الأرباح المحتجزة', name_en: 'Retained Earnings', type: 'equity', normal_balance: 'credit' },
      ],
    },
    {
      code: '4', name_ar: 'الإيرادات', name_en: 'Revenue', type: 'revenue', normal_balance: 'credit', is_group: true,
      children: [
        { code: '41', name_ar: 'إيرادات الخدمات الطبية', name_en: 'Medical Services Revenue', type: 'revenue', normal_balance: 'credit' },
        { code: '42', name_ar: 'إيرادات الصيدلية', name_en: 'Pharmacy Revenue', type: 'revenue', normal_balance: 'credit' },
        { code: '43', name_ar: 'إيرادات اشتراكات التأمين الصحي', name_en: 'Insurance Premium Revenue', type: 'revenue', normal_balance: 'credit' },
      ],
    },
    {
      code: '5', name_ar: 'المصروفات', name_en: 'Expenses', type: 'expense', normal_balance: 'debit', is_group: true,
      children: [
        { code: '51', name_ar: 'مصروف الرواتب', name_en: 'Salaries Expense', type: 'expense', normal_balance: 'debit' },
        { code: '52', name_ar: 'مصروف مستلزمات طبية', name_en: 'Medical Supplies Expense', type: 'expense', normal_balance: 'debit' },
        { code: '53', name_ar: 'مصروف مطالبات التأمين الصحي', name_en: 'Insurance Claims Expense', type: 'expense', normal_balance: 'debit' },
        { code: '54', name_ar: 'مصروفات تشغيلية عامة', name_en: 'General Operating Expenses', type: 'expense', normal_balance: 'debit' },
        { code: '55', name_ar: 'مصروف الإهلاك', name_en: 'Depreciation Expense', type: 'expense', normal_balance: 'debit' },
      ],
    },
  ];

  async function seedAccountNode(node, parentId) {
    const { children, ...accountData } = node;
    const [record, created] = await Account.findOrCreate({
      where: { code: accountData.code },
      defaults: { ...accountData, parent_id: parentId },
    });
    if (created) console.log(`  - حساب: ${accountData.code} ${accountData.name_ar}`);
    if (children) {
      for (const child of children) {
        // eslint-disable-next-line no-await-in-loop
        await seedAccountNode(child, record.id);
      }
    }
  }

  console.log('جارٍ زرع شجرة الحسابات...');
  for (const rootNode of coaTree) {
    await seedAccountNode(rootNode, null);
  }

  console.log('اكتمل البذر الأولي.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('فشل البذر الأولي:', err);
  process.exit(1);
});

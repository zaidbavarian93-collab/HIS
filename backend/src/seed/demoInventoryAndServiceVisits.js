// إضافة مخزون أدوية/مستلزمات طبية متناسب مع حجم المستشفى التجريبي، وتفعيل زيارات فعلية لأقسام
// الأشعة والمختبر والصيدلية (كانت مستثناة من توليد المراجعين لأنها أقسام "خدمية" لا عيادات مباشرة)
// التشغيل: docker compose exec backend node src/seed/demoInventoryAndServiceVisits.js
require('dotenv').config();
const { sequelize, InventoryItem, Department, Patient, User, Appointment, Invoice } = require('../models');
const { postJournalEntry, ACCOUNT_CODES } = require('../services/accounting');

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function randomDateWithinDays(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - randInt(0, daysBack));
  d.setHours(randInt(8, 15), pick([0, 15, 30, 45]), 0, 0);
  return d;
}
function futureExpiry() {
  const d = new Date();
  d.setMonth(d.getMonth() + randInt(6, 30));
  return d.toISOString().slice(0, 10);
}

// قائمة أدوية شائعة في الصيدليات العراقية (أسماء تجارية/علمية معروفة) - كمّيات ومخزون آمن
// متناسبة مع مستشفى 75 سريرًا (استهلاك يومي معتدل + مخزون احتياطي 30-45 يومًا تقريبًا)
const MEDICINES = [
  'باراسيتامول 500 ملغ', 'إيبوبروفين 400 ملغ', 'أموكسيسيلين 500 ملغ', 'أوغمنتين 1 غم',
  'سيبروفلوكساسين 500 ملغ', 'أزيثروميسين 250 ملغ', 'ميتفورمين 500 ملغ', 'أملوديبين 5 ملغ',
  'أتينولول 50 ملغ', 'لوسارتان 50 ملغ', 'أوميبرازول 20 ملغ', 'رانيتيدين 150 ملغ',
  'دومبيريدون 10 ملغ', 'لوراتادين 10 ملغ', 'ديكلوفيناك 50 ملغ', 'ترامادول 50 ملغ',
  'إنسولين ريجولار', 'إنسولين NPH', 'هيبارين', 'وارفارين 5 ملغ',
  'فيتامين سي 500 ملغ', 'فيتامين د3', 'حمض الفوليك', 'كبريتات الحديد',
  'سالبوتامول بخاخ', 'بريدنيزولون 5 ملغ', 'ديكساميثازون حقن', 'فوروسيميد 40 ملغ',
  'سبيرونولاكتون 25 ملغ', 'ديجوكسين 0.25 ملغ', 'كلوبيدوغريل 75 ملغ', 'أتورفاستاتين 20 ملغ',
  'ميتوكلوبراميد', 'أوندانسيترون 4 ملغ', 'مورفين حقن', 'كيتامين حقن (تخدير)',
  'بروبوفول (تخدير)', 'ليدوكائين موضعي', 'محلول ملحي 0.9% وريدي', 'محلول غلوكوز 5% وريدي',
  'رينجر لاكتات', 'مضاد للقيء - ميتوكلوبراميد', 'سيفترياكسون حقن 1غم', 'ميترونيدازول 500 ملغ',
  'فانكومايسين حقن', 'جنتاميسين حقن', 'أنسولين طويل المفعول', 'حبوب منع حمل مركّبة',
  'أوكسيتوسين حقن (توليد)', 'ميثيل إرغومترين', 'مضاد حموضة (مغنيسيوم/ألمنيوم)', 'لاكتولوز شراب',
  'بارالدهيد', 'ديازيبام 5 ملغ', 'فينوباربيتال', 'كاربامازيبين 200 ملغ',
  'سالبيوتامول أقراص', 'أموكسيسيلين شراب أطفال', 'باراسيتامول شراب أطفال', 'فيتامينات أطفال متعددة',
];
const SUPPLIES = [
  'قفازات جراحية معقمة', 'قفازات فحص لاتكس', 'كمامات طبية N95', 'كمامات جراحية',
  'شاش طبي معقم', 'ضمادات لاصقة', 'أربطة ضاغطة', 'محاقن 5 مل', 'محاقن 10 مل', 'إبر وريدية',
  'قسطرة وريدية', 'أكياس دم وريدية (لتوصيل السوائل)', 'أنابيب اختبار دم', 'أطقم سحب دم',
  'أكياس سحب دم (بنك دم)', 'قسطرة بولية', 'أنابيب تنفس اصطناعي', 'أقنعة أوكسجين',
  'مواد تعقيم اليدين', 'كحول طبي 70%', 'بوفيدون آيودين (ديتول جراحي)', 'خيوط جراحية قابلة للامتصاص',
  'خيوط جراحية غير قابلة للامتصاص', 'مشارط جراحية معقمة (أعداد مختلفة)', 'إبر خياطة جراحية',
  'أغطية جراحية معقمة (شراشف)', 'أثواب جراحية معقمة', 'أغطية أحذية طبية', 'أغطية رأس طبية',
  'أفلام أشعة سينية (X-Ray)', 'مواد تباين للأشعة المقطعية', 'جل الموجات فوق الصوتية (سونار)',
  'شرائط فحص السكر', 'أطقم فحص الحمل السريع', 'أطقم فحص فيروس سي/بي', 'أنابيب PCR',
];

async function run() {
  await sequelize.sync();
  console.log('=== إضافة المخزون الطبي وتفعيل زيارات الأقسام الخدمية ===\n');

  // ===== 1) المخزون: أدوية + مستلزمات طبية بأعداد متناسبة مع حجم المستشفى =====
  const existingItems = await InventoryItem.findAll();
  const existingNames = new Set(existingItems.map((i) => i.name));
  let created = 0;

  for (const name of MEDICINES) {
    if (existingNames.has(name)) continue;
    await InventoryItem.create({
      name,
      barcode: `MED${Date.now()}${randInt(100, 999)}${created}`,
      category: 'medicine',
      unit: pick(['علبة', 'شريط', 'قارورة', 'أمبولة']),
      quantity: randInt(50, 800),
      min_stock: randInt(30, 100),
      unit_price: randInt(500, 25000),
      expiry_date: futureExpiry(),
    });
    created += 1;
  }
  for (const name of SUPPLIES) {
    if (existingNames.has(name)) continue;
    await InventoryItem.create({
      name,
      barcode: `SUP${Date.now()}${randInt(100, 999)}${created}`,
      category: 'medical_supply',
      unit: pick(['قطعة', 'علبة', 'كيس', 'صندوق']),
      quantity: randInt(100, 2000),
      min_stock: randInt(50, 200),
      unit_price: randInt(250, 15000),
      expiry_date: Math.random() < 0.5 ? futureExpiry() : null,
    });
    created += 1;
  }
  // بعض أجهزة/معدات القسم كفئة equipment (أعداد قليلة، لا تُستهلك يوميًا)
  const EQUIPMENT = ['جهاز تخطيط قلب', 'جهاز مراقبة علامات حيوية', 'مضخة تسريب وريدي', 'جهاز أوكسجين محمول', 'كرسي متحرك', 'سرير طبي متحرك', 'جهاز شفط طبي', 'حاضنة أطفال خداج'];
  for (const name of EQUIPMENT) {
    if (existingNames.has(name)) continue;
    await InventoryItem.create({
      name,
      barcode: `EQP${Date.now()}${randInt(100, 999)}${created}`,
      category: 'equipment',
      unit: 'جهاز',
      quantity: randInt(2, 15),
      min_stock: 1,
      unit_price: randInt(500000, 8000000),
      expiry_date: null,
    });
    created += 1;
  }
  console.log(`✔ أُضيف ${created} صنفًا مخزنيًا جديدًا (أدوية/مستلزمات/معدات)\n`);

  // ===== 2) تفعيل زيارات لأقسام الأشعة والمختبر والصيدلية (كانت 0 مراجع) =====
  const departments = await Department.findAll();
  const serviceDeptNames = ['Radiology', 'Laboratory', 'Pharmacy'];
  const serviceDepts = departments.filter((d) => serviceDeptNames.includes(d.name_en));
  const patients = await Patient.findAll();
  const doctors = await User.findAll({ where: { role: ['doctor', 'dentist'] } });
  if (patients.length === 0 || doctors.length === 0 || serviceDepts.length === 0) {
    console.log('لا توجد بيانات كافية (مرضى/أطباء/أقسام خدمية) لإكمال هذه الخطوة.');
    process.exit(0);
  }

  const SERVICE_ITEMS = {
    Radiology: ['أشعة سينية عادية', 'أشعة مقطعية (CT)', 'رنين مغناطيسي (MRI)', 'فحص سونار'],
    Laboratory: ['فحص دم شامل (CBC)', 'فحص وظائف كبد', 'فحص وظائف كلى', 'فحص سكر صائم', 'فحص فيروسات كبدية'],
    Pharmacy: ['صرف وصفة طبية - أدوية مزمنة', 'صرف وصفة طبية - مضاد حيوي', 'صرف مستلزمات طبية بوصفة'],
  };
  const SERVICE_PRICE = { Radiology: [25000, 120000], Laboratory: [10000, 40000], Pharmacy: [5000, 60000] };

  const year = new Date().getFullYear();
  let invoiceSeq = (await Invoice.count()) + 1;
  let totalNewVisits = 0;
  let totalNewRevenue = 0;

  for (const dept of serviceDepts) {
    const items = SERVICE_ITEMS[dept.name_en];
    const priceRange = SERVICE_PRICE[dept.name_en];
    const VISITS_FOR_DEPT = randInt(70, 90);

    for (let i = 0; i < VISITS_FOR_DEPT; i += 1) {
      const patient = pick(patients);
      const doctor = pick(doctors); // الطبيب الطالب للفحص/الخدمة
      const scheduled_at = randomDateWithinDays(60);
      const status = pick(['completed', 'completed', 'completed', 'checked_in']);

      await Appointment.create({
        patient_id: patient.id, doctor_id: doctor.id, department_id: dept.id, scheduled_at, status,
      });

      const description = pick(items);
      const unit_price = randInt(priceRange[0], priceRange[1]);
      const total_amount = unit_price;

      const invoice = await Invoice.create({
        invoice_number: `INV-${year}-${String(invoiceSeq).padStart(6, '0')}`,
        patient_id: patient.id,
        items: [{ description: `${description} - ${dept.name_ar}`, quantity: 1, unit_price }],
        total_amount,
        insurance_member_id: null,
        insurance_covered_amount: 0,
        status: status === 'completed' ? 'paid' : 'unpaid',
        createdAt: scheduled_at,
      });
      invoiceSeq += 1;
      totalNewRevenue += total_amount;
      totalNewVisits += 1;

      try {
        await postJournalEntry({
          description: `فاتورة ${invoice.invoice_number}`,
          referenceType: 'invoice', referenceId: invoice.id, date: scheduled_at.toISOString().slice(0, 10),
          lines: [
            { code: ACCOUNT_CODES.PATIENT_RECEIVABLE, debit: total_amount, credit: 0 },
            { code: ACCOUNT_CODES.MEDICAL_SERVICES_REVENUE, debit: 0, credit: total_amount },
          ],
        });
        if (invoice.status === 'paid') {
          await postJournalEntry({
            description: `تحصيل فاتورة ${invoice.invoice_number}`,
            referenceType: 'invoice', referenceId: invoice.id, date: scheduled_at.toISOString().slice(0, 10),
            lines: [
              { code: ACCOUNT_CODES.CASH, debit: total_amount, credit: 0 },
              { code: ACCOUNT_CODES.PATIENT_RECEIVABLE, debit: 0, credit: total_amount },
            ],
          });
        }
      } catch (err) {
        console.error('تعذّر ترحيل قيد فاتورة خدمية:', err.message);
      }
    }
    console.log(`✔ ${dept.name_ar}: أُضيفت ${VISITS_FOR_DEPT} زيارة/فاتورة`);
  }

  console.log(`\n✔ إجمالي الزيارات الجديدة للأقسام الخدمية: ${totalNewVisits} بإيراد تقديري ${totalNewRevenue.toLocaleString()} د.ع`);
  console.log('\n=== اكتمل التحديث بنجاح ===');
  process.exit(0);
}

run().catch((err) => {
  console.error('فشل التحديث:', err);
  process.exit(1);
});

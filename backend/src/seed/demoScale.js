// نموذج تجريبي متكامل لمستشفى أهلي عراقي بسعة 50-100 سرير (اعتمدنا 75 سريرًا كمتوسط تقديري)
// الأعداد والرواتب والواردات هنا تقديرات استرشادية مبنية على نسب شائعة للمستشفيات الأهلية في
// العراق (لا أرقام رسمية معتمدة من وزارة الصحة) - الغرض توليد بيانات واقعية للعرض التسويقي/التوضيحي
// فقط، ويجب استبدالها ببيانات فعلية قبل أي استخدام تشغيلي حقيقي.
//
// التشغيل: docker compose exec backend node src/seed/demoScale.js
require('dotenv').config();
const { sequelize, User, Department, Patient, Appointment, Invoice, Payroll, InsurancePlan, InsuranceMember, SystemSetting } = require('../models');
const { postJournalEntry, ACCOUNT_CODES } = require('../services/accounting');

const MALE_FIRST = ['أحمد', 'محمد', 'علي', 'حسين', 'كريم', 'ياسر', 'مصطفى', 'عمر', 'حيدر', 'صلاح', 'زيد', 'باسم', 'فراس', 'ثائر', 'وسام', 'رعد', 'قاسم', 'سالم', 'جعفر', 'ماجد'];
const FEMALE_FIRST = ['سارة', 'زينب', 'فاطمة', 'نور', 'رغد', 'هبة', 'دينا', 'مريم', 'ياسمين', 'إيمان', 'رنا', 'سجى', 'شهد', 'آية', 'بتول', 'دعاء', 'ريم', 'لمى', 'وفاء', 'نبأ'];
const FAMILY = ['الجبوري', 'العبيدي', 'التميمي', 'الدليمي', 'الكناني', 'السامرائي', 'الموسوي', 'الحسني', 'العزاوي', 'الزبيدي', 'الشمري', 'البياتي', 'الربيعي', 'المالكي', 'القيسي', 'النعيمي', 'الخفاجي', 'السعدي', 'الحيدري', 'الطائي'];

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function randomName(gender) {
  const first = gender === 'female' ? pick(FEMALE_FIRST) : pick(MALE_FIRST);
  return `${first} ${pick(FAMILY)}`;
}
function randomDateWithinDays(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - randInt(0, daysBack));
  d.setHours(randInt(8, 15), pick([0, 15, 30, 45]), 0, 0);
  return d;
}

// نسخة مبسّطة من حساب الاستقطاعات (مطابقة لمنطق backend/src/routes/payroll.js المُتحقَّق سابقًا)
function calculateProgressiveTax(taxableAmount, brackets) {
  let remaining = taxableAmount;
  let tax = 0;
  let lowerBound = 0;
  for (const bracket of brackets) {
    if (remaining <= 0) break;
    const bracketSize = bracket.upTo === null ? remaining : Math.max(0, bracket.upTo - lowerBound);
    const amountInBracket = Math.min(remaining, bracketSize);
    tax += amountInBracket * bracket.rate;
    remaining -= amountInBracket;
    lowerBound = bracket.upTo;
  }
  return Math.round(tax * 100) / 100;
}
function computeStatutoryDeductions(baseSalary, settings) {
  const socialSecurity = Math.round(Number(baseSalary) * settings.social_security_rate * 100) / 100;
  const taxable = Math.max(0, Number(baseSalary) - settings.tax_exempt_monthly);
  const incomeTax = calculateProgressiveTax(taxable, settings.tax_brackets);
  return { socialSecurity, incomeTax };
}

// خطة التوظيف التقديرية لمستشفى 75 سريرًا - النسب مبنية على معايير شائعة (طبيب لكل 5-6 أسرّة،
// تمريض 3 نوبات على مدار الساعة، وفريق فني وإداري وخدمي داعم) لمستشفى أهلي متوسط الحجم في العراق
const STAFF_PLAN = [
  { role: 'doctor', count: 8, grades: ['استشاري', 'أخصائي أول'], salary: [3000000, 5000000], clinicalDept: true },
  { role: 'doctor', count: 10, grades: ['أخصائي', 'ممارس عام', 'مقيم'], salary: [1500000, 2400000], clinicalDept: true },
  { role: 'dentist', count: 2, grades: ['أخصائي'], salary: [2000000, 2800000], clinicalDept: false },
  { role: 'pharmacy', count: 4, grades: ['صيدلاني أول', 'صيدلاني'], salary: [1200000, 1800000], clinicalDept: 'Pharmacy' },
  { role: 'nurse', count: 40, grades: ['ممرض أول', 'ممرض', 'مساعد تمريض'], salary: [500000, 800000], clinicalDept: true },
  { role: 'anesthesia_tech', count: 4, grades: ['فني أول', 'فني'], salary: [600000, 900000], clinicalDept: false },
  { role: 'radiology_tech', count: 4, grades: ['فني أول', 'فني'], salary: [600000, 900000], clinicalDept: 'Radiology' },
  { role: 'lab', count: 6, grades: ['فني أول', 'فني'], salary: [600000, 900000], clinicalDept: 'Laboratory' },
  { role: 'administrative', count: 10, grades: ['رئيس قسم', 'موظف'], salary: [400000, 700000], clinicalDept: false },
  { role: 'worker', count: 12, grades: ['عامل'], salary: [300000, 450000], clinicalDept: false },
  { role: 'billing', count: 3, grades: ['محاسب أول', 'محاسب'], salary: [700000, 1100000], clinicalDept: false },
  { role: 'reception', count: 5, grades: ['موظف استقبال'], salary: [400000, 600000], clinicalDept: false },
  { role: 'management', count: 2, grades: ['مدير إداري'], salary: [2500000, 3500000], clinicalDept: false },
];

const CLINICAL_DEPT_NAMES = ['Internal Medicine', 'General Surgery', 'Obstetrics & Gynecology', 'Pediatrics', 'Emergency'];

async function run() {
  await sequelize.sync();

  console.log('=== إنشاء النموذج التجريبي المتكامل (مستشفى 75 سريرًا تقديريًا) ===\n');

  const departments = await Department.findAll();
  const deptByEn = {};
  departments.forEach((d) => { deptByEn[d.name_en] = d; });
  const clinicalDepts = CLINICAL_DEPT_NAMES.map((n) => deptByEn[n]).filter(Boolean);
  const allDeptIds = departments.map((d) => d.id);

  const deductionSetting = await SystemSetting.findByPk('payroll_deductions');
  const deductions = deductionSetting
    ? deductionSetting.value
    : { social_security_rate: 0.05, tax_exempt_monthly: 208333, tax_brackets: [{ upTo: 20833, rate: 0.03 }, { upTo: 41667, rate: 0.05 }, { upTo: 83333, rate: 0.10 }, { upTo: null, rate: 0.15 }] };

  // ===== 1) الكادر البشري =====
  const existingCount = await User.count();
  let usernameSeq = existingCount + 1;
  const createdStaff = { doctor: [] };

  for (const group of STAFF_PLAN) {
    for (let i = 0; i < group.count; i += 1) {
      const gender = Math.random() > 0.35 ? 'male' : 'female';
      const full_name = (group.role === 'doctor' || group.role === 'dentist' ? 'د. ' : '') + randomName(gender);
      const username = `${group.role}_${usernameSeq}`;
      usernameSeq += 1;

      let department_id = null;
      if (group.clinicalDept === true) {
        department_id = pick(clinicalDepts).id;
      } else if (typeof group.clinicalDept === 'string') {
        department_id = deptByEn[group.clinicalDept]?.id || null;
      }

      const base_salary = randInt(group.salary[0], group.salary[1]);
      const user = await User.create({
        full_name,
        username,
        password_hash: 'Demo@2026',
        role: group.role,
        department_id,
        base_salary,
        job_grade: pick(group.grades),
        gender,
        phone: `07${randInt(70, 91)}${randInt(1000000, 9999999)}`,
        is_active: true,
      });
      if (group.role === 'doctor') createdStaff.doctor.push(user);
    }
    console.log(`✔ أُنشئ ${group.count} موظف بدور "${group.role}"`);
  }

  const allDoctors = createdStaff.doctor;
  console.log(`\nإجمالي الكادر المُنشأ: ${STAFF_PLAN.reduce((s, g) => s + g.count, 0)} موظف\n`);

  // ===== 2) المرضى =====
  const existingPatients = await Patient.count();
  const PATIENT_COUNT = 260;
  const patients = [];
  const year = new Date().getFullYear();
  for (let i = 0; i < PATIENT_COUNT; i += 1) {
    const gender = Math.random() > 0.5 ? 'male' : 'female';
    const serial = String(existingPatients + i + 1).padStart(6, '0');
    const patient = await Patient.create({
      full_name: randomName(gender),
      file_number: `HOSP-${year}-${serial}`,
      gender,
      phone: `07${randInt(70, 91)}${randInt(1000000, 9999999)}`,
      date_of_birth: `${randInt(1950, 2020)}-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`,
      blood_type: pick(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']),
    });
    patients.push(patient);
  }
  console.log(`✔ أُنشئ ${PATIENT_COUNT} مريض\n`);

  // ===== 3) خطط/مشتركو التأمين (لتغطية جزء من الزيارات) =====
  const plans = await InsurancePlan.findAll();
  const citizenPlan = plans.find((p) => p.category === 'citizen' && !p.insurance_company_id);
  const insuranceMembers = [];
  if (citizenPlan) {
    for (let i = 0; i < 40; i += 1) {
      const patient = patients[randInt(0, patients.length - 1)];
      const memberCount = await InsuranceMember.count();
      const member = await InsuranceMember.create({
        plan_id: citizenPlan.id,
        member_type: 'citizen',
        full_name: patient.full_name,
        patient_id: patient.id,
        policy_number: `INS-${year}-${String(memberCount + 1).padStart(6, '0')}`,
        coverage_percentage: citizenPlan.coverage_percentage,
        annual_max_coverage: citizenPlan.annual_max_coverage,
        status: 'active',
        start_date: `${year}-01-01`,
      });
      insuranceMembers.push(member);
    }
    console.log(`✔ أُنشئ ${insuranceMembers.length} مشترك تأمين مرتبط بمرضى فعليين\n`);
  }

  // ===== 4) الزيارات (المواعيد) والفواتير - آخر 60 يومًا =====
  // متوسط ~150 زيارة/شهر (عيادات خارجية + طوارئ) لمستشفى أهلي 75 سريرًا - تقدير استرشادي
  const VISITS = 300;
  let invoiceSeq = (await Invoice.count()) + 1;
  let totalRevenue = 0;
  let insuredVisits = 0;

  for (let i = 0; i < VISITS; i += 1) {
    const dept = pick(departments.filter((d) => d.type !== 'service') .length ? departments.filter((d) => d.type !== 'service') : departments);
    const doctorsInDept = allDoctors.filter((d) => d.department_id === dept.id);
    const doctor = doctorsInDept.length > 0 ? pick(doctorsInDept) : pick(allDoctors);
    const patient = pick(patients);
    const scheduled_at = randomDateWithinDays(60);
    const status = pick(['completed', 'completed', 'completed', 'checked_in']);

    const appointment = await Appointment.create({
      patient_id: patient.id,
      doctor_id: doctor.id,
      department_id: dept.id,
      scheduled_at,
      status,
    });

    // سعر الزيارة يتفاوت حسب القسم (جراحة/نسائية أعلى كلفة من العيادات العامة) - تقدير استرشادي
    const baseFee = Number(dept.consultation_fee) || 20000;
    const serviceMultiplier = pick([1, 1, 1.2, 1.5, 2]);
    const unit_price = Math.round((baseFee || 15000) * serviceMultiplier);
    const total_amount = unit_price;

    let insurance_member_id = null;
    let insuranceCoveredAmount = 0;
    if (Math.random() < 0.3 && insuranceMembers.length > 0) {
      const member = insuranceMembers[randInt(0, insuranceMembers.length - 1)];
      const coveragePercent = Number(member.coverage_percentage) / 100;
      let covered = Math.round(total_amount * coveragePercent * 100) / 100;
      if (member.annual_max_coverage !== null) {
        const remaining = Number(member.annual_max_coverage) - Number(member.used_amount_this_year);
        covered = Math.max(0, Math.min(covered, remaining));
      }
      insurance_member_id = member.id;
      insuranceCoveredAmount = covered;
      member.used_amount_this_year = Number(member.used_amount_this_year) + covered;
      await member.save();
      insuredVisits += 1;
    }

    const invoice = await Invoice.create({
      invoice_number: `INV-${year}-${String(invoiceSeq).padStart(6, '0')}`,
      patient_id: patient.id,
      items: [{ description: `استشارة/خدمة - ${dept.name_ar}`, quantity: 1, unit_price }],
      total_amount,
      insurance_member_id,
      insurance_covered_amount: insuranceCoveredAmount,
      status: status === 'completed' ? 'paid' : 'unpaid',
      createdAt: scheduled_at,
    });
    invoiceSeq += 1;
    totalRevenue += total_amount;

    const patientPortion = total_amount - insuranceCoveredAmount;
    try {
      await postJournalEntry({
        description: `فاتورة ${invoice.invoice_number}`,
        referenceType: 'invoice', referenceId: invoice.id, date: scheduled_at.toISOString().slice(0, 10),
        lines: [
          { code: ACCOUNT_CODES.PATIENT_RECEIVABLE, debit: patientPortion, credit: 0 },
          { code: ACCOUNT_CODES.INSURANCE_RECEIVABLE, debit: insuranceCoveredAmount, credit: 0 },
          { code: ACCOUNT_CODES.MEDICAL_SERVICES_REVENUE, debit: 0, credit: total_amount },
        ],
      });
      if (invoice.status === 'paid' && patientPortion > 0) {
        await postJournalEntry({
          description: `تحصيل فاتورة ${invoice.invoice_number}`,
          referenceType: 'invoice', referenceId: invoice.id, date: scheduled_at.toISOString().slice(0, 10),
          lines: [
            { code: ACCOUNT_CODES.CASH, debit: patientPortion, credit: 0 },
            { code: ACCOUNT_CODES.PATIENT_RECEIVABLE, debit: 0, credit: patientPortion },
          ],
        });
      }
    } catch (err) {
      console.error('تعذّر ترحيل قيد فاتورة تجريبية:', err.message);
    }

    if (i % 50 === 0) console.log(`  ... ${i}/${VISITS} زيارة`);
  }
  console.log(`✔ أُنشئ ${VISITS} زيارة/فاتورة (منها ${insuredVisits} مغطاة تأمينيًا) بإجمالي إيراد تقديري ${totalRevenue.toLocaleString()} د.ع خلال 60 يومًا\n`);

  // ===== 5) الرواتب - شهرين سابقين =====
  const allActiveStaff = await User.findAll({ where: { is_active: true } });
  const now = new Date();
  const months = [];
  for (let m = 2; m >= 1; m -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - m + 1, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  for (const month of months) {
    let monthTotalNet = 0;
    for (const emp of allActiveStaff) {
      const existing = await Payroll.findOne({ where: { user_id: emp.id, month } });
      if (existing) continue;

      const { socialSecurity, incomeTax } = computeStatutoryDeductions(emp.base_salary, deductions);
      const net_salary = Number(emp.base_salary) - socialSecurity - incomeTax;
      monthTotalNet += net_salary;

      const payroll = await Payroll.create({
        user_id: emp.id, month,
        base_salary: emp.base_salary, allowances: 0, deductions: 0,
        social_security_deduction: socialSecurity, income_tax_deduction: incomeTax,
        net_salary, status: 'paid', paid_at: new Date(`${month}-28`),
        notes: `ضمان اجتماعي: ${socialSecurity} | ضريبة دخل: ${incomeTax}`,
      });

      const grossExpense = Number(emp.base_salary);
      try {
        await postJournalEntry({
          description: `صرف راتب ${month}`,
          referenceType: 'payroll', referenceId: payroll.id, date: `${month}-28`,
          lines: [
            { code: ACCOUNT_CODES.SALARIES_EXPENSE, debit: grossExpense, credit: 0 },
            { code: ACCOUNT_CODES.CASH, debit: 0, credit: Number(net_salary) },
            { code: ACCOUNT_CODES.SOCIAL_SECURITY_PAYABLE, debit: 0, credit: socialSecurity },
            { code: ACCOUNT_CODES.INCOME_TAX_PAYABLE, debit: 0, credit: incomeTax },
          ],
        });
      } catch (err) {
        console.error('تعذّر ترحيل قيد راتب تجريبي:', err.message);
      }
    }
    console.log(`✔ رواتب شهر ${month}: ${allActiveStaff.length} كشف، إجمالي الصافي ≈ ${Math.round(monthTotalNet).toLocaleString()} د.ع`);
  }

  console.log('\n=== اكتمل توليد النموذج التجريبي المتكامل بنجاح ===');
  process.exit(0);
}

run().catch((err) => {
  console.error('فشل توليد النموذج التجريبي:', err);
  process.exit(1);
});

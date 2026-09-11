// قاعدة الأجور المرتبطة بالبصمة: الدوام الرسمي 8:30 صباحًا
// - تأخير حتى 30 دقيقة (حتى 9:00): لا خصم
// - تأخير من 30 دقيقة إلى ساعتين (9:00 - 10:30): خصم نصف الأجر اليومي
// - تأخير أكثر من ساعتين (بعد 10:30) أو غياب كامل بلا بصمة: لا يُحتسب أي أجر لهذا اليوم
// - "معفى" (عذر مقبول مرفق): يُلغي أي خصم مهما كان وقت البصمة أو الغياب
const OFFICIAL_START_HOUR = 8;
const OFFICIAL_START_MINUTE = 30;
const HALF_DEDUCTION_GRACE_MINUTES = 30; // بعدها يبدأ خصم النصف
const FULL_DEDUCTION_THRESHOLD_MINUTES = 120; // بعدها لا يُحتسب أي أجر
// توقيت العراق (بغداد) - إزاحة ثابتة UTC+3 بلا توقيت صيفي. نحسب "الساعة 8:30" بهذا التوقيت دائمًا
// بغض النظر عن المنطقة الزمنية لخادم النظام (الحاوية تعمل بتوقيت UTC) لتفادي احتساب تأخير خاطئ
const HOSPITAL_UTC_OFFSET_HOURS = 3;
const OFFICIAL_START_MINUTES_OF_DAY = OFFICIAL_START_HOUR * 60 + OFFICIAL_START_MINUTE;

// يحسب أثر سجل حضور واحد على الأجر اليومي: 'full' (كامل بلا خصم) | 'half' (نصف الأجر) | 'none' (بلا أجر)
function computeDayWageImpact(record) {
  if (record.is_excused) return { impact: 'full', lateMinutes: null, reason: 'excused' };

  if (!record.check_in || record.status === 'absent') {
    return { impact: 'none', lateMinutes: null, reason: 'absent' };
  }

  const checkIn = new Date(record.check_in);
  // نحوّل لحظة البصمة (UTC) إلى دقائق منذ منتصف الليل بتوقيت بغداد المحلي عبر حساب صريح،
  // بدل getHours()/setHours() اللتين تعتمدان على منطقة الخادم الزمنية (قد تختلف عن بغداد)
  const baghdadMs = checkIn.getTime() + HOSPITAL_UTC_OFFSET_HOURS * 3600000;
  const baghdadDate = new Date(baghdadMs);
  const minutesSinceMidnight = baghdadDate.getUTCHours() * 60 + baghdadDate.getUTCMinutes();
  const lateMinutes = Math.max(0, minutesSinceMidnight - OFFICIAL_START_MINUTES_OF_DAY);

  if (lateMinutes > FULL_DEDUCTION_THRESHOLD_MINUTES) return { impact: 'none', lateMinutes, reason: 'late_over_2h' };
  if (lateMinutes > HALF_DEDUCTION_GRACE_MINUTES) return { impact: 'half', lateMinutes, reason: 'late_over_30m' };
  return { impact: 'full', lateMinutes, reason: 'on_time' };
}

// يجمع خصم شهر كامل من سجلات حضور موظف واحد، على أساس الأجر اليومي (base_salary / 30)
function computeMonthlyAttendanceDeduction(records, dailyRate) {
  let deduction = 0;
  let fullDays = 0;
  let halfDays = 0;
  let zeroDays = 0;
  let excusedDays = 0;

  records.forEach((record) => {
    const { impact } = computeDayWageImpact(record);
    if (record.is_excused) excusedDays += 1;
    if (impact === 'half') {
      deduction += dailyRate / 2;
      halfDays += 1;
    } else if (impact === 'none') {
      deduction += dailyRate;
      zeroDays += 1;
    } else {
      fullDays += 1;
    }
  });

  return { deduction: Math.round(deduction * 100) / 100, fullDays, halfDays, zeroDays, excusedDays };
}

module.exports = { computeDayWageImpact, computeMonthlyAttendanceDeduction, OFFICIAL_START_HOUR, OFFICIAL_START_MINUTE };

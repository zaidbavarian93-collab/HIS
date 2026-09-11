const { Op } = require('sequelize');
const cron = require('node-cron');
const { Notification, Appointment, Patient, User, Department, InsuranceMember } = require('../models');

// جدول التشغيل التلقائي اليومي (صيغة cron) - افتراضيًا كل يوم الساعة 7:00 صباحًا، قبل بدء الدوام
const NOTIFICATIONS_CRON = process.env.NOTIFICATIONS_CRON || '0 7 * * *';
let scheduledTask = null;

// ===== بوابة الإرسال الفعلية (قابلة للاستبدال) =====
// لا يوجد حاليًا تعاقد مع بوابة SMS/بريد حقيقية (تحتاج مفاتيح API من مزوّد مثل Twilio أو مزوّد
// عراقي محلي، وتُدخَل عبر متغيرات بيئة SMS_API_KEY/SMTP_*). في غياب ذلك تُحاكى عملية الإرسال هنا
// مع تسجيل كامل في قاعدة البيانات - فور توفر بيانات اعتماد حقيقية، استبدل محتوى هاتين الدالتين
// باستدعاء فعلي لواجهة برمجة المزوّد وأبقِ التوقيع كما هو ليعمل الباقي دون أي تعديل آخر.
async function sendSmsReal(phone, message) {
  throw new Error('لم يتم إعداد بوابة SMS حقيقية بعد (SMS_API_KEY غير مضبوط)');
}
async function sendEmailReal(email, subject, message) {
  throw new Error('لم يتم إعداد خادم بريد حقيقي بعد (SMTP_HOST غير مضبوط)');
}

const REAL_GATEWAY_CONFIGURED = !!process.env.SMS_API_KEY || !!process.env.SMTP_HOST;

// يُرسل تنبيهًا واحدًا (فعليًا إن توفرت بوابة، أو محاكاة إن لم تتوفر) ويحدّث حالته في قاعدة البيانات
async function dispatchNotification(notification) {
  try {
    if (REAL_GATEWAY_CONFIGURED) {
      if (notification.channel === 'sms' && notification.recipient_phone) {
        await sendSmsReal(notification.recipient_phone, notification.message);
      } else if (notification.channel === 'email' && notification.recipient_email) {
        await sendEmailReal(notification.recipient_email, 'تنبيه من نظام إدارة المستشفيات', notification.message);
      }
      notification.simulated = false;
    } else {
      notification.simulated = true; // محاكاة: لا بوابة حقيقية معدّة
    }
    notification.status = 'sent';
    notification.sent_at = new Date();
  } catch (err) {
    notification.status = 'failed';
  }
  await notification.save();
  return notification;
}

// يُنشئ تذكيرات لمواعيد الغد (booked فقط) التي لم يُنشأ لها تذكير سابقًا
async function generateAppointmentReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const start = new Date(tomorrow); start.setHours(0, 0, 0, 0);
  const end = new Date(tomorrow); end.setHours(23, 59, 59, 999);

  const appointments = await Appointment.findAll({
    where: { scheduled_at: { [Op.between]: [start, end] }, status: { [Op.in]: ['booked', 'checked_in'] } },
    include: [
      { model: Patient, attributes: ['id', 'full_name', 'phone'] },
      { model: User, as: 'doctor', attributes: ['id', 'full_name'] },
      { model: Department, attributes: ['name_ar'] },
    ],
  });

  const existing = await Notification.findAll({
    where: { notification_type: 'appointment_reminder', related_type: 'Appointment', related_id: appointments.map((a) => a.id) },
    attributes: ['related_id'],
  });
  const alreadyNotified = new Set(existing.map((n) => n.related_id));

  const toCreate = appointments
    .filter((a) => !alreadyNotified.has(a.id) && a.Patient?.phone)
    .map((a) => {
      const time = new Date(a.scheduled_at).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      return {
        notification_type: 'appointment_reminder',
        channel: 'sms',
        recipient_name: a.Patient.full_name,
        recipient_phone: a.Patient.phone,
        message: `تذكير: لديك موعد غدًا الساعة ${time} في قسم ${a.Department?.name_ar || '-'} مع ${a.doctor?.full_name || 'الطبيب المعالج'} - مستشفى Starlight`,
        related_type: 'Appointment',
        related_id: a.id,
        status: 'pending',
        scheduled_for: new Date(),
      };
    });

  if (toCreate.length > 0) await Notification.bulkCreate(toCreate);
  return toCreate.length;
}

// يُنشئ تنبيهات لاشتراكات التأمين التي تنتهي خلال 7 أيام ولم يُنشأ لها تنبيه سابقًا
async function generateInsuranceRenewalReminders() {
  const today = new Date();
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);

  const members = await InsuranceMember.findAll({
    where: {
      status: 'active',
      end_date: { [Op.between]: [today.toISOString().slice(0, 10), in7Days.toISOString().slice(0, 10)] },
    },
  });

  const existing = await Notification.findAll({
    where: { notification_type: 'insurance_renewal', related_type: 'InsuranceMember', related_id: members.map((m) => m.id) },
    attributes: ['related_id'],
  });
  const alreadyNotified = new Set(existing.map((n) => n.related_id));

  const toCreate = members
    .filter((m) => !alreadyNotified.has(m.id) && m.phone)
    .map((m) => ({
      notification_type: 'insurance_renewal',
      channel: 'sms',
      recipient_name: m.full_name,
      recipient_phone: m.phone,
      message: `تنبيه: اشتراكك التأميني رقم ${m.policy_number} ينتهي بتاريخ ${m.end_date} - يرجى التجديد لتفادي انقطاع التغطية - مستشفى Starlight`,
      related_type: 'InsuranceMember',
      related_id: m.id,
      status: 'pending',
      scheduled_for: new Date(),
    }));

  if (toCreate.length > 0) await Notification.bulkCreate(toCreate);
  return toCreate.length;
}

// يُرسل كل التنبيهات المعلّقة التي حان وقتها (فعليًا أو محاكاة)
async function dispatchPendingNotifications() {
  const pending = await Notification.findAll({ where: { status: 'pending', scheduled_for: { [Op.lte]: new Date() } } });
  for (const n of pending) {
    // eslint-disable-next-line no-await-in-loop
    await dispatchNotification(n);
  }
  return pending.length;
}

// دورة كاملة: توليد + إرسال - تُستدعى يوميًا عبر cron أو يدويًا من لوحة التحكم للعرض التجريبي
async function runNotificationCycle() {
  const appointmentsCount = await generateAppointmentReminders();
  const renewalsCount = await generateInsuranceRenewalReminders();
  const dispatchedCount = await dispatchPendingNotifications();
  return { appointmentsCount, renewalsCount, dispatchedCount };
}

// يفعّل الجدولة التلقائية اليومية عند إقلاع الخادم (تذكيرات المواعيد وتجديد التأمين)
function startScheduledNotifications() {
  if (scheduledTask) return;
  scheduledTask = cron.schedule(NOTIFICATIONS_CRON, () => {
    runNotificationCycle().catch((err) => {
      console.error('فشلت دورة التنبيهات التلقائية المجدوَلة:', err.message);
    });
  });
  console.log(`تم تفعيل تنبيهات المواعيد والتجديد التلقائية (الجدول: ${NOTIFICATIONS_CRON})`);
}

module.exports = {
  generateAppointmentReminders,
  generateInsuranceRenewalReminders,
  dispatchPendingNotifications,
  runNotificationCycle,
  startScheduledNotifications,
  REAL_GATEWAY_CONFIGURED,
};

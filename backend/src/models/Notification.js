const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// تنبيه مجدول (تذكير موعد أو تجديد تأمين) عبر SMS أو بريد إلكتروني - يُسجَّل هنا بغض النظر عن وجود
// بوابة إرسال فعلية متعاقد معها؛ عند عدم توفر بوابة حقيقية (Twilio أو مزوّد عراقي محلي...) يُحاكى
// الإرسال (status='sent' مع simulated=true) ليبقى سجلًا كاملًا جاهزًا لربط بوابة حقيقية لاحقًا
class Notification extends Model {}

Notification.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    // appointment_reminder: تذكير بموعد قريب | insurance_renewal: تنبيه اقتراب انتهاء اشتراك تأمين
    notification_type: { type: DataTypes.STRING, allowNull: false },
    channel: { type: DataTypes.STRING, allowNull: false, defaultValue: 'sms' }, // sms | email
    recipient_name: { type: DataTypes.STRING, allowNull: false },
    recipient_phone: { type: DataTypes.STRING, allowNull: true },
    recipient_email: { type: DataTypes.STRING, allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: false },
    related_type: { type: DataTypes.STRING, allowNull: true }, // Appointment | InsuranceMember
    related_id: { type: DataTypes.UUID, allowNull: true },
    // pending: بانتظار وقت الإرسال | sent: أُرسل (فعليًا أو محاكاة) | failed: تعذّر الإرسال
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
    simulated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    scheduled_for: { type: DataTypes.DATE, allowNull: false },
    sent_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
  }
);

module.exports = Notification;

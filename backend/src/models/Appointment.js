const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Appointment extends Model {}

Appointment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    patient_id: { type: DataTypes.UUID, allowNull: false },
    doctor_id: { type: DataTypes.UUID, allowNull: false },
    department_id: { type: DataTypes.UUID, allowNull: false },
    scheduled_at: { type: DataTypes.DATE, allowNull: false },
    status: {
      // booked: محجوز | checked_in: وصل المريض | in_progress: قيد الكشف
      // completed: انتهى | cancelled: ملغى | no_show: لم يحضر
      type: DataTypes.ENUM(
        'booked',
        'checked_in',
        'in_progress',
        'completed',
        'cancelled',
        'no_show'
      ),
      defaultValue: 'booked',
    },
    notes: { type: DataTypes.STRING, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: true }, // المستخدم اللي حجز الموعد

    // ===== طابور الانتظار =====
    // رقم التذكرة داخل طابور القسم لهذا اليوم - يُولَّد تلقائيًا عند تسجيل وصول المريض (checked_in)
    queue_number: { type: DataTypes.INTEGER, allowNull: true },
    // وقت تسجيل الوصول الفعلي - يُستخدم لحساب مدة الانتظار المعروضة في لوحة الطابور
    checked_in_at: { type: DataTypes.DATE, allowNull: true },
    // urgent: حالة عاجلة تتقدّم على البقية في الطابور بغض النظر عن رقم التذكرة
    priority: {
      type: DataTypes.ENUM('normal', 'urgent'),
      allowNull: false,
      defaultValue: 'normal',
    },
  },
  {
    sequelize,
    modelName: 'Appointment',
    tableName: 'appointments',
  }
);

module.exports = Appointment;

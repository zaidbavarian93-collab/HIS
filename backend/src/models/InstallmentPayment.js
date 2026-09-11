const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// دفعة واحدة ضمن جدول خطة أقساط - سجل مسبق لكل الدفعات المستقبلية (pending) يُحدَّث فور التحصيل
class InstallmentPayment extends Model {}

InstallmentPayment.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    installment_plan_id: { type: DataTypes.UUID, allowNull: false },
    installment_number: { type: DataTypes.INTEGER, allowNull: false }, // 0 = الدفعة الأولى، 1..N = الأقساط
    due_date: { type: DataTypes.DATEONLY, allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    // pending: لم يحن موعدها بعد أو حان ولم تُسدَّد | paid: سُدِّدت | overdue: تجاوزت موعدها بلا سداد
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
    paid_at: { type: DataTypes.DATE, allowNull: true },
    paid_by: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'InstallmentPayment',
    tableName: 'installment_payments',
  }
);

module.exports = InstallmentPayment;

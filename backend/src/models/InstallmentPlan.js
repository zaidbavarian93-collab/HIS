const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// خطة أقساط لفاتورة عملية كبرى (1,000,000 د.ع فأكثر) - تُقسّم المبلغ المستحق على المريض (بعد خصم
// التأمين إن وُجد) إلى دفعات دورية بدل تحصيلها دفعة واحدة، مع دفعة أولى اختيارية
class InstallmentPlan extends Model {}

InstallmentPlan.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    plan_number: { type: DataTypes.STRING, allowNull: false, unique: true }, // INST-YYYY-NNNNNN
    invoice_id: { type: DataTypes.UUID, allowNull: false },
    patient_id: { type: DataTypes.UUID, allowNull: false },
    total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false }, // المبلغ الخاضع للتقسيط (مستحق المريض)
    down_payment: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    installments_count: { type: DataTypes.INTEGER, allowNull: false },
    installment_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    // active: قيد السداد | completed: اكتملت كل الدفعات | cancelled: أُلغيت (تعود الفاتورة لحالتها الأصلية)
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'InstallmentPlan',
    tableName: 'installment_plans',
  }
);

module.exports = InstallmentPlan;

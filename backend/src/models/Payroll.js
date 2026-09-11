const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// كشف راتب موظف عن شهر محدد
class Payroll extends Model {}

Payroll.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: { type: DataTypes.UUID, allowNull: false },
    // صيغة الشهر: YYYY-MM
    month: { type: DataTypes.STRING(7), allowNull: false },
    base_salary: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    allowances: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    deductions: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    net_salary: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    // ملخّص الحضور المُستخرج من كشف الحضور عند توليد الراتب (لأغراض العرض والمراجعة)
    present_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    absent_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    late_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    leave_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    attendance_deduction: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    // استقطاعات نظامية محسوبة تلقائيًا حسب إعدادات النظام (قابلة للتعديل قبل الصرف)
    social_security_deduction: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    income_tax_deduction: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    status: {
      type: DataTypes.ENUM('pending', 'paid'),
      defaultValue: 'pending',
    },
    paid_at: { type: DataTypes.DATE, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Payroll',
    tableName: 'payrolls',
    indexes: [{ unique: true, fields: ['user_id', 'month'] }],
  }
);

module.exports = Payroll;

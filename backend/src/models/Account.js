const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// شجرة الحسابات (دليل الحسابات) - هيكل هرمي مترابط وفق تصنيف النظام المحاسبي الموحد العراقي:
// 1 الأصول | 2 الخصوم | 3 حقوق الملكية | 4 الإيرادات | 5 المصروفات
class Account extends Model {}

Account.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: { type: DataTypes.STRING, allowNull: false, unique: true }, // رمز الحساب الهرمي مثل 111
    name_ar: { type: DataTypes.STRING, allowNull: false },
    name_en: { type: DataTypes.STRING, allowNull: false },
    // asset | liability | equity | revenue | expense
    type: { type: DataTypes.STRING, allowNull: false },
    // debit | credit - الطبيعة الدائنة/المدينة الافتراضية للحساب
    normal_balance: { type: DataTypes.STRING, allowNull: false },
    parent_id: { type: DataTypes.UUID, allowNull: true }, // يبني الشجرة الهرمية
    is_group: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, // حساب رئيسي تجميعي لا تُرحَّل إليه قيود مباشرة
    description_ar: { type: DataTypes.TEXT, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    modelName: 'Account',
    tableName: 'accounts',
  }
);

module.exports = Account;

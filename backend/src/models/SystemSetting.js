const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// إعدادات عامة للنظام مخزّنة كمفتاح/قيمة (JSON) - مثل نسب استقطاعات الرواتب
class SystemSetting extends Model {}

SystemSetting.init(
  {
    key: { type: DataTypes.STRING, allowNull: false, unique: true, primaryKey: true },
    value: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  },
  {
    sequelize,
    modelName: 'SystemSetting',
    tableName: 'system_settings',
    timestamps: true,
    underscored: true,
  }
);

module.exports = SystemSetting;

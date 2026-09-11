const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Department extends Model {}

Department.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name_ar: { type: DataTypes.STRING, allowNull: false },
    name_en: { type: DataTypes.STRING, allowNull: false },
    // outpatient = عيادة خارجية | inpatient = قسم تنويم | service = خدمي (مختبر/صيدلية..)
    type: {
      type: DataTypes.ENUM('outpatient', 'inpatient', 'service'),
      allowNull: false,
      defaultValue: 'outpatient',
    },
    consultation_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    // شعار/صورة القسم المرفوعة - إن كانت فارغة تُعرض أيقونة افتراضية حسب نوع القسم بدلًا منها
    logo_file: { type: DataTypes.STRING, allowNull: true },
    logo_original_name: { type: DataTypes.STRING, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Department',
    tableName: 'departments',
  }
);

module.exports = Department;

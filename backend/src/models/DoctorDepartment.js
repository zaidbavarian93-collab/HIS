const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// ربط طبيب بقسم (وفئة اختيارية داخل القسم) - علاقة متعددة لأطراف
class DoctorDepartment extends Model {}

DoctorDepartment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    doctor_id: { type: DataTypes.UUID, allowNull: false },
    department_id: { type: DataTypes.UUID, allowNull: false },
    category_id: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'DoctorDepartment',
    tableName: 'doctor_departments',
    indexes: [
      { unique: true, fields: ['doctor_id', 'department_id', 'category_id'] },
    ],
  }
);

module.exports = DoctorDepartment;

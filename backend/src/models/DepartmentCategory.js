const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// فئة فرعية داخل القسم (مثال: قسم الباطنية -> فئات: قلبية، غدد صماء، جهاز هضمي)
class DepartmentCategory extends Model {}

DepartmentCategory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    department_id: { type: DataTypes.UUID, allowNull: false },
    name_ar: { type: DataTypes.STRING, allowNull: false },
    name_en: { type: DataTypes.STRING, allowNull: false },
  },
  {
    sequelize,
    modelName: 'DepartmentCategory',
    tableName: 'department_categories',
  }
);

module.exports = DepartmentCategory;

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// سجل حضور/انصراف يومي لموظف
class Attendance extends Model {}

Attendance.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: { type: DataTypes.UUID, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    check_in: { type: DataTypes.DATE, allowNull: true },
    check_out: { type: DataTypes.DATE, allowNull: true },
    // present: حاضر | late: متأخر | absent: غائب | leave: إجازة
    status: {
      type: DataTypes.ENUM('present', 'late', 'absent', 'leave'),
      allowNull: false,
      defaultValue: 'present',
    },
    notes: { type: DataTypes.STRING, allowNull: true },
    // عذر مقبول عن التأخير/الغياب (تقرير طبي، مهمة رسمية...) - إن وُجد يُلغي خصم الأجر مهما كان وقت البصمة
    is_excused: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    excuse_reason: { type: DataTypes.STRING, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Attendance',
    tableName: 'attendances',
    indexes: [{ unique: true, fields: ['user_id', 'date'] }],
  }
);

module.exports = Attendance;

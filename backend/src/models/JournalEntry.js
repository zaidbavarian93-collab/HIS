const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// قيد يومية محاسبي - يُولَّد تلقائيًا من عمليات النظام (فوترة، تأمين، رواتب) أو يدويًا من المحاسب
class JournalEntry extends Model {}

JournalEntry.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    entry_number: { type: DataTypes.STRING, allowNull: false, unique: true },
    entry_date: { type: DataTypes.DATEONLY, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: false },
    // invoice | payroll | insurance | inventory | manual - مصدر القيد داخل النظام
    reference_type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'manual' },
    reference_id: { type: DataTypes.UUID, allowNull: true },
    total_amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    created_by: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'JournalEntry',
    tableName: 'journal_entries',
  }
);

module.exports = JournalEntry;

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// سطر ضمن قيد يومية - كل سطر يخص حسابًا واحدًا من شجرة الحسابات (مدين أو دائن)
class JournalEntryLine extends Model {}

JournalEntryLine.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    journal_entry_id: { type: DataTypes.UUID, allowNull: false },
    account_id: { type: DataTypes.UUID, allowNull: false },
    debit: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    credit: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    description: { type: DataTypes.STRING, allowNull: true },
  },
  {
    sequelize,
    modelName: 'JournalEntryLine',
    tableName: 'journal_entry_lines',
  }
);

module.exports = JournalEntryLine;

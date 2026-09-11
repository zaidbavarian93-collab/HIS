const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Invoice extends Model {}

Invoice.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    invoice_number: { type: DataTypes.STRING, allowNull: false, unique: true },
    patient_id: { type: DataTypes.UUID, allowNull: false },
    // بنود الفاتورة كمصفوفة JSON: [{ description, quantity, unit_price }]
    items: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    // التأمين الصحي - إن كان المريض مؤمَّنًا يُطبَّق خصم تلقائي حسب نسبة تغطية خطته
    insurance_member_id: { type: DataTypes.UUID, allowNull: true },
    insurance_covered_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    // installment: مسجَّلة ضمن خطة أقساط نشطة - لا تُسدَّد دفعة واحدة عبر مسار /pay العادي
    status: {
      type: DataTypes.ENUM('unpaid', 'paid', 'cancelled', 'installment'),
      defaultValue: 'unpaid',
    },
    paid_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Invoice',
    tableName: 'invoices',
  }
);

module.exports = Invoice;

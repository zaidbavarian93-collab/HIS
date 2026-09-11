const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// مطالبة تأمين مقدَّمة لشركة تأمين خارجية عن حصة فاتورة غطّاها التأمين - دورة حياة كاملة:
// submitted (قُدِّمت) -> under_review (قيد المراجعة من الشركة) -> approved/partially_approved/rejected
// -> paid (سُدِّدت فعليًا وتم ترحيل القيد المحاسبي)
const CLAIM_STATUSES = ['submitted', 'under_review', 'approved', 'partially_approved', 'rejected', 'paid'];

class Claim extends Model {}

Claim.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    claim_number: { type: DataTypes.STRING, allowNull: false, unique: true }, // CLM-YYYY-NNNNNN
    invoice_id: { type: DataTypes.UUID, allowNull: false },
    insurance_member_id: { type: DataTypes.UUID, allowNull: false },
    insurance_company_id: { type: DataTypes.UUID, allowNull: false },
    amount_claimed: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    amount_approved: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'submitted' },
    rejection_reason: { type: DataTypes.TEXT, allowNull: true },
    submitted_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    reviewed_at: { type: DataTypes.DATE, allowNull: true },
    paid_at: { type: DataTypes.DATE, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Claim',
    tableName: 'claims',
  }
);

module.exports = { Claim, CLAIM_STATUSES };

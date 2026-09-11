const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// معاملة تحصيل قسط عبر بوابة مصرفية خارجية (نموذج مصرف الرافدين) - يُنشأ السجل عند طلب الدفع عبر
// البنك (initiated)، ويتحوّل إلى confirmed عند وصول تأكيد البنك عبر webhook موقّع بمفتاح API الخاص
// بالبوابة، أو failed إن رفض البنك العملية. لا يوجد تعاقد فعلي حاليًا مع مصرف الرافدين أو أي بنك -
// هذا نموذج توضيحي (Reference Implementation) جاهز للربط الفعلي فور توفر تعاقد ومفاتيح API حقيقية.
class BankGatewayTransaction extends Model {}

BankGatewayTransaction.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    reference_number: { type: DataTypes.STRING, allowNull: false, unique: true }, // RAF-YYYY-NNNNNN
    bank_name: { type: DataTypes.STRING, allowNull: false, defaultValue: 'مصرف الرافدين' },
    installment_payment_id: { type: DataTypes.UUID, allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    // initiated: بانتظار تأكيد البنك | confirmed: أكّد البنك السداد | failed: رفض البنك/فشلت العملية
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'initiated' },
    bank_transaction_id: { type: DataTypes.STRING, allowNull: true }, // الرقم المرجعي الصادر من نظام البنك نفسه
    simulated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    raw_callback: { type: DataTypes.JSONB, allowNull: true },
    initiated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    confirmed_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'BankGatewayTransaction',
    tableName: 'bank_gateway_transactions',
  }
);

module.exports = BankGatewayTransaction;

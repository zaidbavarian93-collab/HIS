const { DataTypes, Model } = require('sequelize');
const crypto = require('crypto');
const sequelize = require('../config/db');

// شركة تأمين خارجية متعاقدة مع المستشفى - كل شركة تملك مفتاح API خاص بها للاتصال المباشر
// بمحرك المطالبات (التحقق من التغطية لحظيًا، متابعة المطالبات) دون الحاجة لحساب مستخدم داخلي
class InsuranceCompany extends Model {}

InsuranceCompany.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name_ar: { type: DataTypes.STRING, allowNull: false },
    name_en: { type: DataTypes.STRING, allowNull: false },
    contact_person: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.STRING, allowNull: true },
    // مفتاح API فريد يُستخدم من الشركة نفسها للمصادقة على نقاط النهاية الخارجية (بدل JWT الداخلي)
    api_key: { type: DataTypes.STRING, allowNull: false, unique: true, defaultValue: () => crypto.randomBytes(24).toString('hex') },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'InsuranceCompany',
    tableName: 'insurance_companies',
  }
);

module.exports = InsuranceCompany;

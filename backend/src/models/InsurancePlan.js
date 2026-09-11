const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// خطة تأمين صحي - مستوحاة من نموذج التأمين الصحي الوطني (كوريا الجنوبية NHIS): تغطية شاملة
// بنسبة محددة، بدل شهري رمزي، وسقف تغطية سنوي يحمي من الفواتير الكارثية
class InsurancePlan extends Model {}

InsurancePlan.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name_ar: { type: DataTypes.STRING, allowNull: false },
    name_en: { type: DataTypes.STRING, allowNull: false },
    // citizen: للمواطنين عامة | staff: لكادر المستشفى | dependent: للمقربين من الدرجة الأولى
    category: { type: DataTypes.STRING, allowNull: false, defaultValue: 'citizen' },
    // فارغة = خطة داخلية يديرها المستشفى نفسه (النموذج الأصلي المستوحى من NHIS)
    // محدّدة = خطة تابعة لشركة تأمين خارجية متعاقدة - تُنشئ مطالبات فعلية عبر محرك المطالبات
    insurance_company_id: { type: DataTypes.UUID, allowNull: true },
    coverage_percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 70 },
    monthly_premium: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    annual_max_coverage: { type: DataTypes.DECIMAL(12, 2), allowNull: true }, // سقف التغطية السنوي - null = بلا سقف
    description_ar: { type: DataTypes.TEXT, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    modelName: 'InsurancePlan',
    tableName: 'insurance_plans',
  }
);

module.exports = InsurancePlan;

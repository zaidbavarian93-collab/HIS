const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// عضو مؤمَّن (مشترك في التأمين الصحي) - مواطن، أحد كادر المستشفى، أو أحد مقربيه من الدرجة الأولى
class InsuranceMember extends Model {}

InsuranceMember.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    plan_id: { type: DataTypes.UUID, allowNull: false },
    // citizen: مواطن عادي | staff: من كادر المستشفى | dependent: قريب من الدرجة الأولى لأحد الكادر
    member_type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'citizen' },
    full_name: { type: DataTypes.STRING, allowNull: false },
    national_id: { type: DataTypes.STRING, allowNull: true },
    date_of_birth: { type: DataTypes.DATEONLY, allowNull: true },
    gender: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    // صلة القرابة إن كان العضو من المقربين (زوج/زوجة، ابن/ابنة، أب/أم)
    relation: { type: DataTypes.STRING, allowNull: true },
    // ربط بموظف الكادر (سواء كان هو المشترك أو صاحب القرابة للمعال)
    related_staff_id: { type: DataTypes.UUID, allowNull: true },
    // ربط اختياري بسجل مريض موجود في النظام لتطبيق التغطية تلقائيًا على فواتيره
    patient_id: { type: DataTypes.UUID, allowNull: true },
    // رقم بوليصة فريد يُولَّد تلقائيًا - يظهر على بطاقة التأمين
    policy_number: { type: DataTypes.STRING, allowNull: false, unique: true },
    coverage_percentage: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 70 },
    annual_max_coverage: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    used_amount_this_year: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    // active: فعّال | expired: منتهي | suspended: موقوف
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: true },
  },
  {
    sequelize,
    modelName: 'InsuranceMember',
    tableName: 'insurance_members',
  }
);

module.exports = InsuranceMember;

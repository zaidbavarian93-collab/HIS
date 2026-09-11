const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Patient extends Model {}

Patient.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // رقم ملف المريض - يُولَّد تلقائيًا عند التسجيل (يظهر على البطاقة والفواتير)
    file_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    full_name: { type: DataTypes.STRING, allowNull: false },
    national_id: { type: DataTypes.STRING, allowNull: true }, // رقم البطاقة الوطنية/الهوية
    date_of_birth: { type: DataTypes.DATEONLY, allowNull: true },
    gender: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.STRING, allowNull: true },
    blood_type: { type: DataTypes.STRING, allowNull: true },
    allergies: { type: DataTypes.TEXT, allowNull: true },
    emergency_contact_name: { type: DataTypes.STRING, allowNull: true },
    emergency_contact_phone: { type: DataTypes.STRING, allowNull: true },

    // ===== السجل الصحي التفصيلي =====
    chronic_diseases: { type: DataTypes.TEXT, allowNull: true }, // الأمراض المزمنة (سكري، ضغط...)
    disabilities: { type: DataTypes.TEXT, allowNull: true }, // الإعاقات
    current_medications: { type: DataTypes.TEXT, allowNull: true }, // الأدوية المستمرة حاليًا
    past_surgeries: { type: DataTypes.TEXT, allowNull: true }, // العمليات الجراحية السابقة
    family_medical_history: { type: DataTypes.TEXT, allowNull: true }, // التاريخ المرضي العائلي
    // none: لا يدخّن | current: مدخّن حاليًا | former: مدخّن سابقًا
    smoking_status: { type: DataTypes.STRING, allowNull: true },
    height_cm: { type: DataTypes.DECIMAL(5, 1), allowNull: true },
    weight_kg: { type: DataTypes.DECIMAL(5, 1), allowNull: true },
    marital_status: { type: DataTypes.STRING, allowNull: true },
    occupation: { type: DataTypes.STRING, allowNull: true },
    nationality: { type: DataTypes.STRING, allowNull: true },
    insurance_provider: { type: DataTypes.STRING, allowNull: true }, // جهة التأمين الصحي
    insurance_number: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true }, // ملاحظات عامة إضافية
  },
  {
    sequelize,
    modelName: 'Patient',
    tableName: 'patients',
  }
);

module.exports = Patient;

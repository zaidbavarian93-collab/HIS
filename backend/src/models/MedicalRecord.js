const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class MedicalRecord extends Model {}

MedicalRecord.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    patient_id: { type: DataTypes.UUID, allowNull: false },
    doctor_id: { type: DataTypes.UUID, allowNull: false },
    appointment_id: { type: DataTypes.UUID, allowNull: true },
    visit_date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    chief_complaint: { type: DataTypes.TEXT, allowNull: true }, // الشكوى الرئيسية
    diagnosis: { type: DataTypes.TEXT, allowNull: true },
    vital_signs: { type: DataTypes.JSONB, allowNull: true }, // { bp, temp, pulse, resp_rate, spo2 }
    prescription: { type: DataTypes.JSONB, allowNull: true }, // [{ drug, dose, frequency, duration }]
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'MedicalRecord',
    tableName: 'medical_records',
  }
);

module.exports = MedicalRecord;

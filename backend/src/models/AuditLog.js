const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// سجل تدقيق غير قابل للتعديل (append-only) لكل إجراء حساس في النظام: من قام به، متى، وماذا تغيّر
// فعليًا (قبل/بعد) - مستقل عن القيود المحاسبية التي تُسجّل الأثر المالي فقط لا هوية من نفّذ الإجراء
// بالتفصيل. لا يوجد UPDATE أو DELETE على هذا الجدول من أي مسار في النظام عن قصد.
class AuditLog extends Model {}

AuditLog.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: true },
    // اسم المستخدم ودوره وقت التنفيذ يُخزَّنان هنا مباشرة (denormalized) حتى يبقى السجل مقروءًا
    // بوضوح حتى لو حُذف حساب المستخدم لاحقًا أو تغيّر دوره
    user_name: { type: DataTypes.STRING, allowNull: true },
    user_role: { type: DataTypes.STRING, allowNull: true },
    // login_success | login_failed | create | update | delete | approve | reject | pay | collect_premium ...
    action: { type: DataTypes.STRING, allowNull: false },
    // اسم الكيان المتأثر: User | Payroll | StaffRequest | InsuranceMember | Claim | Department | ...
    entity_type: { type: DataTypes.STRING, allowNull: false },
    entity_id: { type: DataTypes.UUID, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: false },
    before_data: { type: DataTypes.JSONB, allowNull: true },
    after_data: { type: DataTypes.JSONB, allowNull: true },
    ip_address: { type: DataTypes.STRING, allowNull: true },
  },
  {
    sequelize,
    modelName: 'AuditLog',
    tableName: 'audit_logs',
    updatedAt: false, // سجل ثابت لحظة إنشائه فقط - لا معنى لتاريخ "تعديل" على سجل تدقيق
  }
);

module.exports = AuditLog;

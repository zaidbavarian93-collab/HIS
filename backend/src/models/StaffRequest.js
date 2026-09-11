const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// طلبات إدارة الكوادر المقدّمة من رؤساء الأقسام (نقل / إضافة / تعديل / حذف) - تبقى "قيد المعالجة"
// حتى يوافق عليها مدير النظام أو يرفضها. لا تشمل الراتب الأساسي إطلاقًا مهما كان محتوى payload،
// فالموافقة (routes/staffRequests.js) تتجاهل أي قيمة base_salary موجودة فيه قسرًا.
const REQUEST_TYPES = ['add', 'edit', 'transfer', 'delete'];
const REQUEST_STATUSES = ['pending', 'approved', 'rejected'];

class StaffRequest extends Model {}

StaffRequest.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    request_type: { type: DataTypes.STRING, allowNull: false }, // add | edit | transfer | delete
    requested_by: { type: DataTypes.UUID, allowNull: false }, // رئيس القسم مقدّم الطلب
    department_id: { type: DataTypes.UUID, allowNull: true }, // قسم مقدّم الطلب وقت التقديم
    target_user_id: { type: DataTypes.UUID, allowNull: true }, // فارغ في حال "إضافة" موظف جديد
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }, // البيانات المقترحة (بلا راتب)
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
    review_note: { type: DataTypes.TEXT, allowNull: true },
    reviewed_by: { type: DataTypes.UUID, allowNull: true },
    reviewed_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: 'StaffRequest',
    tableName: 'staff_requests',
  }
);

module.exports = { StaffRequest, REQUEST_TYPES, REQUEST_STATUSES };

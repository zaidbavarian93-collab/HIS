const { AuditLog } = require('../models');

// يسجّل حدثًا في سجل التدقيق - لا يُفشل الطلب الأصلي أبدًا إن تعذّر التسجيل (يُطبع الخطأ فقط)
// req اختياري: يُستخدم لاستخراج هوية المنفّذ (req.user) وعنوان IP تلقائيًا عند توفره
async function logAudit({ req, userId, userName, userRole, action, entityType, entityId, description, before, after }) {
  try {
    await AuditLog.create({
      user_id: userId ?? req?.user?.id ?? null,
      user_name: userName ?? req?.user?.full_name ?? null,
      user_role: userRole ?? req?.user?.role ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      description,
      before_data: before || null,
      after_data: after || null,
      ip_address: req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.ip || req?.socket?.remoteAddress || null,
    });
  } catch (err) {
    console.error('تعذّر تسجيل سجل التدقيق:', err.message);
  }
}

module.exports = { logAudit };

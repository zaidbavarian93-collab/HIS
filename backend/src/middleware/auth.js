const jwt = require('jsonwebtoken');

// يتحقق من صلاحية التوكن ويضيف بيانات المستخدم إلى الطلب
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'يجب تسجيل الدخول أولاً' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role, full_name }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'جلسة الدخول غير صالحة أو منتهية' });
  }
}

// يسمح فقط لأدوار معينة بالوصول - مثال: authorize('admin', 'reception')
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'لا تملك صلاحية للقيام بهذا الإجراء' });
    }
    next();
  };
}

// يسمح فقط لرؤساء الأقسام (is_department_head) - لا يشمل admin عمدًا، فالمدير يستخدم مسارات
// /users المباشرة، بينما رؤساء الأقسام يقدّمون طلبات عبر /staff-requests تحتاج موافقته لاحقًا
function requireDepartmentHead(req, res, next) {
  if (!req.user || !req.user.is_department_head) {
    return res.status(403).json({ message: 'هذه الصلاحية مقصورة على رؤساء الأقسام' });
  }
  next();
}

module.exports = { authenticate, authorize, requireDepartmentHead };

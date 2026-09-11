const { InsuranceCompany } = require('../models');

// مصادقة شركات التأمين الخارجية عبر مفتاح API (ترويسة X-Api-Key) بدل JWT الداخلي - يُستخدم فقط
// من نقاط نهاية "بوابة شركة التأمين" (insurerPortal.js) التي تتيح التحقق من التغطية ومتابعة المطالبات
async function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) return res.status(401).json({ message: 'مفتاح API مطلوب (ترويسة X-Api-Key)' });

  const company = await InsuranceCompany.findOne({ where: { api_key: apiKey, is_active: true } });
  if (!company) return res.status(401).json({ message: 'مفتاح API غير صالح أو الشركة غير مفعّلة' });

  req.insuranceCompany = company;
  next();
}

module.exports = { authenticateApiKey };

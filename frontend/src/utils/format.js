// يضمن أن كل الأرقام المعروضة في النظام إنكليزية (٠١٢٣ ممنوعة) بغض النظر عن لغة الواجهة أو
// إعدادات المتصفح - نستخدم 'en-US' صراحةً بدل الاعتماد على toLocaleString() الافتراضي الذي
// يعرض أرقامًا هندية-عربية عند اللغة العربية
export function formatNumber(value, options) {
  const n = Number(value || 0);
  return n.toLocaleString('en-US', options);
}

export function formatMoney(value) {
  return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDateTime(value) {
  const d = value ? new Date(value) : new Date();
  return d.toLocaleString('en-GB');
}

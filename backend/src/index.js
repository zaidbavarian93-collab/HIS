require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { sequelize } = require('./models');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const departmentRoutes = require('./routes/departments');
const patientRoutes = require('./routes/patients');
const appointmentRoutes = require('./routes/appointments');
const medicalRecordRoutes = require('./routes/medicalRecords');
const invoiceRoutes = require('./routes/invoices');
const inventoryRoutes = require('./routes/inventory');
const payrollRoutes = require('./routes/payroll');
const attendanceRoutes = require('./routes/attendance');
const backupRoutes = require('./routes/backup');
const kpiRoutes = require('./routes/kpis');
const settingsRoutes = require('./routes/settings');
const insuranceRoutes = require('./routes/insurance');
const accountingRoutes = require('./routes/accounting');
const staffRequestRoutes = require('./routes/staffRequests');
const adminActivityRoutes = require('./routes/adminActivity');
const insuranceCompanyRoutes = require('./routes/insuranceCompanies');
const claimRoutes = require('./routes/claims');
const insurerPortalRoutes = require('./routes/insurerPortal');
const auditLogRoutes = require('./routes/auditLogs');
const notificationRoutes = require('./routes/notifications');
const installmentRoutes = require('./routes/installments');
const bankGatewayRoutes = require('./routes/bankGateway');
const { startScheduledBackups } = require('./services/backup');
const { startScheduledNotifications } = require('./services/notifications');

// حماية عامة: أي خطأ غير مُعالَج (Promise مرفوض لم يُلتقط) كان سيُسقط عملية Node بالكامل
// (وبالتالي يُعطّل النظام لكل المستخدمين)، بدل أن يبقى محصورًا بالطلب الذي تسبب به فقط
process.on('unhandledRejection', (reason) => {
  console.error('خطأ غير مُعالَج (unhandledRejection):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('استثناء غير مُعالَج (uncaughtException):', err);
});

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// شعارات الأقسام: ملفات عامة غير حساسة (أيقونات بصرية فقط) تُقدَّم مباشرة دون توثيق JWT
// لأن عناصر <img> لا ترسل ترويسة Authorization - يبقى الرفع/الحذف نفسه محميًا بصلاحية admin
app.use('/api/uploads/department-logos', express.static(path.join(__dirname, '..', 'uploads', 'department-logos')));

// نفس المنطق لصور الكادر الشخصية: عرض عام بدون JWT، الرفع/الحذف محمي بصلاحية admin
app.use('/api/uploads/staff-photos', express.static(path.join(__dirname, '..', 'uploads', 'staff-photos')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/staff-requests', staffRequestRoutes);
app.use('/api/admin-activity', adminActivityRoutes);
app.use('/api/insurance-companies', insuranceCompanyRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/insurer-portal', insurerPortalRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/installments', installmentRoutes);
app.use('/api/bank-gateway', bankGatewayRoutes);

// معالج أخطاء عام (يشمل أخطاء multer مثل نوع/حجم الملف غير المسموح)
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'حجم الملف أكبر من الحد المسموح (10 ميجابايت)' });
  }
  if (err.message && err.message.includes('نوع الملف غير مدعوم')) {
    return res.status(400).json({ message: err.message });
  }
  res.status(500).json({ message: 'حدث خطأ غير متوقع في الخادم' });
});

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('تم الاتصال بقاعدة البيانات بنجاح');

    // في الإنتاج الفعلي يُفضَّل استخدام migrations بدل sync
    await sequelize.sync({ alter: process.env.NODE_ENV !== 'production' });

    app.listen(PORT, () => {
      console.log(`الخادم يعمل على المنفذ ${PORT}`);
    });

    startScheduledBackups();
    startScheduledNotifications();
  } catch (err) {
    console.error('فشل الاتصال بقاعدة البيانات:', err);
    process.exit(1);
  }
}

start();

const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/db');

// الأدوار المسموحة في النظام - من الطبيب نزولًا لكل فئات الموظفين، بكل التدرجات
// (تُطبَّق كتحقق على مستوى التطبيق فقط - العمود نفسه نص حر لتفادي مشاكل تعديل ENUM لاحقًا)
const ROLES = [
  'admin',           // مدير النظام (صلاحية كاملة)
  'management',      // إدارة عليا - تقارير فقط
  'administrative',  // موظف إداري
  'reception',       // استقبال وتسجيل المرضى والمواعيد
  'doctor',          // طبيب
  'dentist',         // طبيب أسنان
  'pharmacy',        // صيدلي
  'nurse',           // تمريض
  'anesthesia_tech', // فني تخدير
  'radiology_tech',  // فني أشعة
  'lab',             // فني مختبر
  'billing',         // محاسبة وفوترة
  'worker',          // عامل/خدمات
];

const GENDERS = ['male', 'female'];
const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'];

class User extends Model {
  async validatePassword(plainPassword) {
    return bcrypt.compare(plainPassword, this.password_hash);
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // اختياري: ربط المستخدم بقسم (لأطباء مثلاً)
    department_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // رئيس قسم/شعبة: صلاحية موسّعة فوق الدور الأساسي (لا تُغيّر الدور نفسه) تسمح باقتراح نقل/إضافة/
    // تعديل/حذف كوادر ضمن قسمه فقط عبر طلبات تحتاج موافقة مدير النظام - لا تمنح أي صلاحية على الرواتب إطلاقًا
    is_department_head: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    // الراتب الأساسي الشهري - يُستخدم كقيمة افتراضية عند توليد كشف الرواتب
    base_salary: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    // ===== البيانات الشخصية والمهنية التفصيلية =====
    date_of_birth: { type: DataTypes.DATEONLY, allowNull: true },
    gender: { type: DataTypes.STRING, allowNull: true }, // male/female
    phone: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    // الشهادة/المؤهل العلمي (مثال: بكالوريوس طب وجراحة، دبلوم تمريض...)
    qualification: { type: DataTypes.STRING, allowNull: true },
    // التدرج الوظيفي/الطبي - نص حر (استشاري، أخصائي أول، ممرض أول، فني أول...) يشمل كل الفئات
    job_grade: { type: DataTypes.STRING, allowNull: true },
    // الحالة الاجتماعية
    marital_status: { type: DataTypes.STRING, allowNull: true },
    // هل الموظف مرتبط بجهة أخرى (حكومية أو خاصة) - نص حر يوضح اسم الجهة إن وُجد
    external_affiliation: { type: DataTypes.STRING, allowNull: true },
    // اسم ملف الشهادة المرفوع (يُخزَّن فعليًا في مجلد uploads على الخادم)
    certificate_file: { type: DataTypes.STRING, allowNull: true },
    certificate_original_name: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    hooks: {
      beforeCreate: async (user) => {
        if (user.password_hash) {
          user.password_hash = await bcrypt.hash(user.password_hash, 10);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password_hash')) {
          user.password_hash = await bcrypt.hash(user.password_hash, 10);
        }
      },
    },
  }
);

module.exports = { User, ROLES, GENDERS, MARITAL_STATUSES };

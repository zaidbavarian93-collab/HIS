const sequelize = require('../config/db');
const { User } = require('./User');
const Department = require('./Department');
const Patient = require('./Patient');
const Appointment = require('./Appointment');
const MedicalRecord = require('./MedicalRecord');
const Invoice = require('./Invoice');
const DepartmentCategory = require('./DepartmentCategory');
const DoctorDepartment = require('./DoctorDepartment');
const InventoryItem = require('./InventoryItem');
const Payroll = require('./Payroll');
const Attendance = require('./Attendance');
const SystemSetting = require('./SystemSetting');
const InsurancePlan = require('./InsurancePlan');
const InsuranceMember = require('./InsuranceMember');
const Account = require('./Account');
const JournalEntry = require('./JournalEntry');
const JournalEntryLine = require('./JournalEntryLine');
const { StaffRequest } = require('./StaffRequest');
const InsuranceCompany = require('./InsuranceCompany');
const { Claim } = require('./Claim');
const AuditLog = require('./AuditLog');
const Notification = require('./Notification');
const InstallmentPlan = require('./InstallmentPlan');
const InstallmentPayment = require('./InstallmentPayment');
const BankGatewayTransaction = require('./BankGatewayTransaction');

// مستخدم ينتمي لقسم (طبيب مثلاً)
User.belongsTo(Department, { foreignKey: 'department_id' });
Department.hasMany(User, { foreignKey: 'department_id' });

// المواعيد
Appointment.belongsTo(Patient, { foreignKey: 'patient_id' });
Patient.hasMany(Appointment, { foreignKey: 'patient_id' });

Appointment.belongsTo(User, { as: 'doctor', foreignKey: 'doctor_id' });
Appointment.belongsTo(Department, { foreignKey: 'department_id' });

// السجل الطبي
MedicalRecord.belongsTo(Patient, { foreignKey: 'patient_id' });
Patient.hasMany(MedicalRecord, { foreignKey: 'patient_id' });

MedicalRecord.belongsTo(User, { as: 'doctor', foreignKey: 'doctor_id' });
MedicalRecord.belongsTo(Appointment, { foreignKey: 'appointment_id' });

// الفواتير
Invoice.belongsTo(Patient, { foreignKey: 'patient_id' });
Patient.hasMany(Invoice, { foreignKey: 'patient_id' });

// فئات الأقسام
DepartmentCategory.belongsTo(Department, { foreignKey: 'department_id' });
Department.hasMany(DepartmentCategory, { foreignKey: 'department_id', as: 'categories' });

// ربط الأطباء بالأقسام والفئات (علاقة متعددة لأطراف)
DoctorDepartment.belongsTo(User, { as: 'doctor', foreignKey: 'doctor_id' });
DoctorDepartment.belongsTo(Department, { foreignKey: 'department_id' });
DoctorDepartment.belongsTo(DepartmentCategory, { as: 'category', foreignKey: 'category_id' });
User.hasMany(DoctorDepartment, { as: 'departmentLinks', foreignKey: 'doctor_id' });
Department.hasMany(DoctorDepartment, { foreignKey: 'department_id' });

// الرواتب
Payroll.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Payroll, { foreignKey: 'user_id' });

// الحضور والانصراف
Attendance.belongsTo(User, { foreignKey: 'user_id' });
User.hasMany(Attendance, { foreignKey: 'user_id' });

// التأمين الصحي
InsuranceMember.belongsTo(InsurancePlan, { as: 'plan', foreignKey: 'plan_id' });
InsurancePlan.hasMany(InsuranceMember, { foreignKey: 'plan_id' });
InsuranceMember.belongsTo(User, { as: 'relatedStaff', foreignKey: 'related_staff_id' });
InsuranceMember.belongsTo(Patient, { foreignKey: 'patient_id' });
Invoice.belongsTo(InsuranceMember, { as: 'insuranceMember', foreignKey: 'insurance_member_id' });
InsuranceMember.hasMany(Invoice, { foreignKey: 'insurance_member_id' });

// شجرة الحسابات والقيود المحاسبية
Account.belongsTo(Account, { as: 'parent', foreignKey: 'parent_id' });
Account.hasMany(Account, { as: 'children', foreignKey: 'parent_id' });
JournalEntry.hasMany(JournalEntryLine, { as: 'lines', foreignKey: 'journal_entry_id' });
JournalEntryLine.belongsTo(JournalEntry, { foreignKey: 'journal_entry_id' });
JournalEntryLine.belongsTo(Account, { foreignKey: 'account_id' });
Account.hasMany(JournalEntryLine, { foreignKey: 'account_id' });
JournalEntry.belongsTo(User, { as: 'creator', foreignKey: 'created_by' });

// طلبات إدارة الكوادر من رؤساء الأقسام
StaffRequest.belongsTo(User, { as: 'requester', foreignKey: 'requested_by' });
StaffRequest.belongsTo(User, { as: 'targetUser', foreignKey: 'target_user_id' });
StaffRequest.belongsTo(User, { as: 'reviewer', foreignKey: 'reviewed_by' });
StaffRequest.belongsTo(Department, { foreignKey: 'department_id' });

// محرك مطالبات التأمين مع الشركات الخارجية
InsurancePlan.belongsTo(InsuranceCompany, { foreignKey: 'insurance_company_id' });
InsuranceCompany.hasMany(InsurancePlan, { foreignKey: 'insurance_company_id' });
Claim.belongsTo(Invoice, { foreignKey: 'invoice_id' });
Invoice.hasMany(Claim, { foreignKey: 'invoice_id' });
Claim.belongsTo(InsuranceMember, { foreignKey: 'insurance_member_id' });
InsuranceMember.hasMany(Claim, { foreignKey: 'insurance_member_id' });
Claim.belongsTo(InsuranceCompany, { foreignKey: 'insurance_company_id' });
InsuranceCompany.hasMany(Claim, { foreignKey: 'insurance_company_id' });

AuditLog.belongsTo(User, { foreignKey: 'user_id' });

// منصة الأقساط
InstallmentPlan.belongsTo(Invoice, { foreignKey: 'invoice_id' });
Invoice.hasOne(InstallmentPlan, { foreignKey: 'invoice_id' });
InstallmentPlan.belongsTo(Patient, { foreignKey: 'patient_id' });
Patient.hasMany(InstallmentPlan, { foreignKey: 'patient_id' });
InstallmentPayment.belongsTo(InstallmentPlan, { as: 'plan', foreignKey: 'installment_plan_id' });
InstallmentPlan.hasMany(InstallmentPayment, { as: 'payments', foreignKey: 'installment_plan_id' });
BankGatewayTransaction.belongsTo(InstallmentPayment, { foreignKey: 'installment_payment_id' });
InstallmentPayment.hasOne(BankGatewayTransaction, { foreignKey: 'installment_payment_id' });

module.exports = {
  sequelize,
  User,
  Department,
  Patient,
  Appointment,
  MedicalRecord,
  Invoice,
  DepartmentCategory,
  DoctorDepartment,
  InventoryItem,
  Payroll,
  Attendance,
  SystemSetting,
  InsurancePlan,
  InsuranceMember,
  Account,
  JournalEntry,
  JournalEntryLine,
  StaffRequest,
  InsuranceCompany,
  Claim,
  AuditLog,
  Notification,
  InstallmentPlan,
  InstallmentPayment,
  BankGatewayTransaction,
};

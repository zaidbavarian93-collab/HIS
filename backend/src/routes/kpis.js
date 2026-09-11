const express = require('express');
const { Op, fn, col } = require('sequelize');
const {
  Patient,
  Appointment,
  Invoice,
  InventoryItem,
  Payroll,
  Attendance,
  User,
  InsuranceMember,
} = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// لوحة المؤشرات صلاحية admin و management و billing فقط
router.use(authenticate, authorize('admin', 'management', 'billing'));

function monthRange(month) {
  const [year, mon] = month.split('-').map(Number);
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 0, 23, 59, 59);
  return { start, end };
}

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { start, end };
}

// GET /api/kpis?month=YYYY-MM - مؤشرات أداء شاملة للنظام
router.get('/', async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const { start: monthStart, end: monthEnd } = monthRange(month);
  const { start: todayStart, end: todayEnd } = todayRange();

  const [
    totalPatients,
    newPatientsThisMonth,
    appointmentsToday,
    appointmentsThisMonth,
    appointmentStatusRows,
    paidInvoicesThisMonth,
    unpaidInvoices,
    inventoryItems,
    payrollsThisMonth,
    attendanceToday,
    activeUsers,
    usersByRole,
    insuranceCoveredThisMonth,
    insuranceMembersByType,
    insuranceMembersByStatus,
  ] = await Promise.all([
    Patient.count(),
    Patient.count({ where: { created_at: { [Op.between]: [monthStart, monthEnd] } } }),
    Appointment.count({ where: { scheduled_at: { [Op.between]: [todayStart, todayEnd] } } }),
    Appointment.count({ where: { scheduled_at: { [Op.between]: [monthStart, monthEnd] } } }),
    Appointment.findAll({
      attributes: ['status', [fn('COUNT', col('status')), 'count']],
      where: { scheduled_at: { [Op.between]: [monthStart, monthEnd] } },
      group: ['status'],
      raw: true,
    }),
    Invoice.sum('total_amount', {
      where: { status: 'paid', paid_at: { [Op.between]: [monthStart, monthEnd] } },
    }),
    Invoice.findAll({
      attributes: [[fn('COUNT', col('id')), 'count'], [fn('SUM', col('total_amount')), 'total']],
      where: { status: 'unpaid' },
      raw: true,
    }),
    InventoryItem.findAll({ attributes: ['category', 'quantity', 'min_stock', 'unit_price'], raw: true }),
    Payroll.findAll({ attributes: ['net_salary', 'status'], where: { month }, raw: true }),
    Attendance.findAll({
      attributes: ['status'],
      where: { date: `${todayStart.getFullYear()}-${String(todayStart.getMonth() + 1).padStart(2, '0')}-${String(todayStart.getDate()).padStart(2, '0')}` },
      raw: true,
    }),
    User.count({ where: { is_active: true } }),
    User.findAll({
      attributes: ['role', [fn('COUNT', col('role')), 'count']],
      where: { is_active: true },
      group: ['role'],
      raw: true,
    }),
    Invoice.sum('insurance_covered_amount', {
      where: { created_at: { [Op.between]: [monthStart, monthEnd] } },
    }),
    InsuranceMember.findAll({
      attributes: ['member_type', [fn('COUNT', col('member_type')), 'count']],
      where: { status: 'active' },
      group: ['member_type'],
      raw: true,
    }),
    InsuranceMember.findAll({
      attributes: ['status', [fn('COUNT', col('status')), 'count']],
      group: ['status'],
      raw: true,
    }),
  ]);

  const appointmentStatus = appointmentStatusRows.reduce((acc, r) => {
    acc[r.status] = Number(r.count);
    return acc;
  }, {});

  const inventoryLowStock = inventoryItems.filter((i) => i.quantity <= i.min_stock).length;
  const inventoryValue = inventoryItems.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);
  const inventoryByCategory = inventoryItems.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + 1;
    return acc;
  }, {});

  const payrollTotalNet = payrollsThisMonth.reduce((sum, p) => sum + Number(p.net_salary), 0);
  const payrollPaidCount = payrollsThisMonth.filter((p) => p.status === 'paid').length;
  const payrollPendingCount = payrollsThisMonth.length - payrollPaidCount;

  const attendanceSummary = attendanceToday.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  const roleBreakdown = usersByRole.reduce((acc, r) => {
    acc[r.role] = Number(r.count);
    return acc;
  }, {});

  const insuranceByType = insuranceMembersByType.reduce((acc, r) => {
    acc[r.member_type] = Number(r.count);
    return acc;
  }, {});
  const insuranceByStatus = insuranceMembersByStatus.reduce((acc, r) => {
    acc[r.status] = Number(r.count);
    return acc;
  }, {});
  const totalInsuredMembers = Object.values(insuranceByType).reduce((sum, v) => sum + v, 0);

  res.json({
    month,
    patients: {
      total: totalPatients,
      new_this_month: newPatientsThisMonth,
    },
    appointments: {
      today: appointmentsToday,
      this_month: appointmentsThisMonth,
      by_status: appointmentStatus,
    },
    revenue: {
      paid_this_month: Number(paidInvoicesThisMonth) || 0,
      unpaid_count: Number(unpaidInvoices[0]?.count) || 0,
      unpaid_total: Number(unpaidInvoices[0]?.total) || 0,
    },
    inventory: {
      total_items: inventoryItems.length,
      low_stock: inventoryLowStock,
      total_value: Math.round(inventoryValue * 100) / 100,
      by_category: inventoryByCategory,
    },
    payroll: {
      total_net: payrollTotalNet,
      paid_count: payrollPaidCount,
      pending_count: payrollPendingCount,
      total_entries: payrollsThisMonth.length,
    },
    attendance_today: attendanceSummary,
    staff: {
      active_total: activeUsers,
      by_role: roleBreakdown,
    },
    insurance: {
      active_members: totalInsuredMembers,
      by_type: insuranceByType,
      by_status: insuranceByStatus,
      covered_this_month: Number(insuranceCoveredThisMonth) || 0,
    },
  });
});

module.exports = router;

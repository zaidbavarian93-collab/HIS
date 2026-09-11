import StaffRosterPage from '../components/StaffRosterPage';

// الكادر البشري (قسم الحسابات) - نفس بيانات الكادر + تفاصيل مالية إضافية في تصدير Excel
export default function StaffRosterFinance() {
  return <StaffRosterPage titleKey="staff_roster_financial" includeFinancials />;
}

import StaffRosterPage from '../components/StaffRosterPage';

// الكادر البشري (الموارد البشرية) - بيانات كل الكوادر بجميع الفئات بدون تفاصيل مالية
export default function StaffRosterHR() {
  return <StaffRosterPage titleKey="staff_roster" includeFinancials={false} editable />;
}

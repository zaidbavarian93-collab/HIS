import StaffCategoryPage from '../components/StaffCategoryPage';

// فئة مستقلة: الإداريون العامون (مدير النظام، إدارة عليا، إداري، استقبال، محاسبة، عامل/خدمات)
export default function AdminGeneralStaff() {
  return (
    <StaffCategoryPage
      titleKey="admin_general_staff"
      addLabelKey="add_admin_general_staff"
      roleOptions={['admin', 'management', 'administrative', 'reception', 'billing', 'worker']}
    />
  );
}

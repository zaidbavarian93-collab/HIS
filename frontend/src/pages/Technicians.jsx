import StaffCategoryPage from '../components/StaffCategoryPage';

// فئة مستقلة: التقنيون الطبيون والصحيون (تمريض، تخدير، أشعة، مختبر)
export default function Technicians() {
  return (
    <StaffCategoryPage
      titleKey="technicians_staff"
      addLabelKey="add_technician"
      roleOptions={['nurse', 'anesthesia_tech', 'radiology_tech', 'lab']}
    />
  );
}

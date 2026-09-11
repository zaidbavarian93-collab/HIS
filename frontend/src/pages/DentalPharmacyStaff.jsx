import StaffCategoryPage from '../components/StaffCategoryPage';

// فئة مستقلة: أطباء الأسنان والصيادلة
export default function DentalPharmacyStaff() {
  return (
    <StaffCategoryPage
      titleKey="dental_pharmacy_staff"
      addLabelKey="add_dental_pharmacy_staff"
      roleOptions={['dentist', 'pharmacy']}
    />
  );
}

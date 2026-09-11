import InventoryManager from '../components/InventoryManager';

// الصيدلية: الأدوية فقط
export default function Pharmacy() {
  return (
    <InventoryManager
      pageTitleKey="pharmacy"
      allowedCategories={['medicine']}
      defaultCategory="medicine"
    />
  );
}

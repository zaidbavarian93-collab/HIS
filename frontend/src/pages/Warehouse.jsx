import InventoryManager from '../components/InventoryManager';

// المخازن: المستلزمات الطبية والأجهزة والمعدات (كل ما هو غير أدوية)
export default function Warehouse() {
  return (
    <InventoryManager
      pageTitleKey="warehouse"
      allowedCategories={['medical_supply', 'equipment']}
      defaultCategory="medical_supply"
    />
  );
}

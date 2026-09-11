const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

// أصناف المخزن/الصيدلية
class InventoryItem extends Model {}

InventoryItem.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING, allowNull: false },
    // باركود الصنف - يُستخدم لعمليات الإدخال/الصرف السريعة عبر قارئ الباركود
    barcode: { type: DataTypes.STRING, allowNull: true, unique: true },
    // medicine: دواء | medical_supply: مستلزمات طبية | equipment: أجهزة/معدات
    category: {
      type: DataTypes.ENUM('medicine', 'medical_supply', 'equipment'),
      allowNull: false,
      defaultValue: 'medicine',
    },
    unit: { type: DataTypes.STRING, allowNull: false, defaultValue: 'قطعة' },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    min_stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    unit_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    expiry_date: { type: DataTypes.DATEONLY, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'InventoryItem',
    tableName: 'inventory_items',
  }
);

module.exports = InventoryItem;

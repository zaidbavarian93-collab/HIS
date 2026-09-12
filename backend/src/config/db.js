const { Sequelize } = require('sequelize');
require('dotenv').config();

const commonOptions = {
  dialect: 'postgres',
  logging: false,
  define: {
    underscored: true,
    timestamps: true,
  },
};

// بعض منصات الاستضافة (مثل Render) تعطي رابط اتصال واحد جاهز بدل حقول منفصلة
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      ...commonOptions,
      dialectOptions: process.env.DB_SSL === 'true' ? { ssl: { require: true, rejectUnauthorized: false } } : {},
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      { ...commonOptions, host: process.env.DB_HOST, port: process.env.DB_PORT || 5432 }
    );

module.exports = sequelize;

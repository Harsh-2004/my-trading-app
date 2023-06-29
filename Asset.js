const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Asset = sequelize.define('Asset', {
  id: {
    type: DataTypes.TEXT,
    primaryKey: true,
    allowNull: false,
    field: 'id ',
    autoIncrement: true,
    
  },
  name: {
    type: DataTypes.TEXT,
    field: 'name',
    allowNull: false,
  },
  symbol: {
    type: DataTypes.TEXT,
    field: 'symbol',
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    field: 'created_at',
    allowNull: false,
  },
  updated_at: {
    type: DataTypes.DATE,
    field: 'updated_at',
    allowNull: false,
  },
  price: {
    type: DataTypes.TEXT,
    field: 'price',
  },
}, {
  tableName: 'Assets'
});

module.exports = Asset;





const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('Trading_app', 'postgres', 'post', {
  host: 'localhost',
  port: 5434, // Replace with your PostgreSQL port
  dialect: 'postgres',
});

module.exports = sequelize;

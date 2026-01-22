/**
 * ==========================================
 * DATABASE CONFIGURATION (PostgreSQL)
 * ==========================================
 */

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'forex_ai',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres123',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

/**
 * Testa conexão com banco
 */
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL conectado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar PostgreSQL:', error.message);
    console.log('⚠️  Usando fallback JSON');
    return false;
  }
}

/**
 * Sincroniza models
 */
async function syncDatabase() {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Database sincronizado');
  } catch (error) {
    console.error('❌ Erro ao sincronizar database:', error.message);
  }
}

module.exports = {
  sequelize,
  testConnection,
  syncDatabase
};

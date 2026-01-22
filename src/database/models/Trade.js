/**
 * ==========================================
 * TRADE MODEL (Sequelize)
 * ==========================================
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config');

const Trade = sequelize.define('Trade', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tradeId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  instrument: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('BUY', 'SELL'),
    allowNull: false
  },
  orderType: {
    type: DataTypes.ENUM('MARKET', 'LIMIT'),
    allowNull: false
  },
  entryPrice: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  exitPrice: {
    type: DataTypes.FLOAT
  },
  stopLoss: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  takeProfit: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  result: {
    type: DataTypes.ENUM('WIN', 'LOSS', 'BREAKEVEN', 'OPEN'),
    defaultValue: 'OPEN'
  },
  profitLoss: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  riskReward: {
    type: DataTypes.FLOAT
  },
  probability: {
    type: DataTypes.FLOAT
  },
  timeframe: {
    type: DataTypes.STRING
  },
  entryTimestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  exitTimestamp: {
    type: DataTypes.DATE
  },
  justification: {
    type: DataTypes.JSON
  }
}, {
  tableName: 'trades',
  timestamps: true
});

module.exports = Trade;

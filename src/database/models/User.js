/**
 * ==========================================
 * USER MODEL (Sequelize)
 * ==========================================
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  role: {
    type: DataTypes.ENUM('admin', 'trader', 'viewer'),
    defaultValue: 'trader'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLogin: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 10);
      }
    }
  }
});

/**
 * Método para comparar senha
 */
User.prototype.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = User;

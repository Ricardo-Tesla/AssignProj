const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Adjust path as needed

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  type: {
    type: DataTypes.ENUM('project', 'group', 'task', 'individual'),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  groupId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Groups',
      key: 'id'
    }
  },
  taskId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Tasks',
      key: 'id'
    }
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  indexes: [
    { fields: ['userId'] },
    { fields: ['groupId'] },
    { fields: ['taskId'] },
    { fields: ['type'] },
    { fields: ['isRead'] }
  ],
  timestamps: true
});

module.exports = Notification;
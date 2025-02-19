const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Submission = sequelize.define('Submission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  taskId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  submitterId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fileUrl: {
    type: DataTypes.STRING,
    allowNull: false
  },
  submissionTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  isLate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  comments: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});

module.exports = Submission;
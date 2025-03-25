const Notification = require('../model/Notification');

const createNotification= async function(type, message, userId, groupId, taskId, transaction, createdBy) {
  try {
    return await Notification.create({
      type,
      message,
      userId,
      groupId,
      taskId,
      createdBy,
      isRead: false
    }, { transaction });
  } catch (error) {
    console.error('Failed to create notification:', error);
    throw error;
  }
}

module.exports = { createNotification };
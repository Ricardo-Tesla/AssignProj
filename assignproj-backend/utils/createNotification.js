const Notification = require('../model/Notification');

const createNotification = async (type, message, userId, groupId = null, taskId = null, transaction = null, createdBy) => {
  return await Notification.create({
    type,
    message,
    userId,
    groupId,
    relatedTaskId: taskId,
    createdBy, // Now correctly referencing the parameter
  }, transaction ? { transaction } : {});
};

module.exports = { createNotification };

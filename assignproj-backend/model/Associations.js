const Project = require('./Project');
const Group = require('./Group');
const GroupMember = require('./GroupMember');
const User = require('./Users');
const Task = require('./Task');
const Notification = require('./Notification');
const Message = require('./Message');
const Submission = require('./Submission');

// Project - Group associations
Project.hasMany(Group, { foreignKey: 'projectId' });
Group.belongsTo(Project, { foreignKey: 'projectId' });

// Group - GroupMember associations
Group.hasMany(GroupMember, { foreignKey: 'groupId' });
GroupMember.belongsTo(Group, { foreignKey: 'groupId' });

// User associations with Group and GroupMember
Group.belongsTo(User, { as: 'teamLeader', foreignKey: 'teamLeaderId' });
GroupMember.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(GroupMember, { foreignKey: 'userId' });

// Task associations
Task.belongsTo(User, { as: 'assignedTo', foreignKey: 'assignedToId' });
Task.belongsTo(Group, { foreignKey: 'groupId' });
Group.hasMany(Task, { foreignKey: 'groupId' });
User.hasMany(Task, { foreignKey: 'assignedToId', as: 'assignedTasks' });

// Notification associations
User.hasMany(Notification, { foreignKey: 'userId' });
Notification.belongsTo(User, { foreignKey: 'userId' });
Task.hasMany(Notification, { foreignKey: 'relatedTaskId' });
Notification.belongsTo(Task, { foreignKey: 'relatedTaskId' });
Group.hasMany(Notification, { foreignKey: 'groupId' });
Notification.belongsTo(Group, { foreignKey: 'groupId' });
Notification.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'Recipient' });

// Message associations
Message.belongsTo(User, { as: 'sender', foreignKey: 'senderId' });
Message.belongsTo(Group, { foreignKey: 'groupId' });
Group.hasMany(Message, { foreignKey: 'groupId' });

// Submission associations
Submission.belongsTo(Task, { foreignKey: 'taskId' });
Submission.belongsTo(User, { as: 'submitter', foreignKey: 'submitterId' });
Task.hasMany(Submission, { foreignKey: 'taskId' });

module.exports = {Project, Group, GroupMember, User,Task, Notification, Message, Submission};
const Project = require('./Project');
const Group = require('./Group');
const GroupMember = require('./GroupMember');
const User = require('./Users');
const Task = require('./Task');


Project.hasMany(Group, { foreignKey: 'projectId' });
Group.belongsTo(Project, { foreignKey: 'projectId' });

Group.hasMany(GroupMember, { foreignKey: 'groupId' });
GroupMember.belongsTo(Group, { foreignKey: 'groupId' });

Group.belongsTo(User, { as: 'teamLeader', foreignKey: 'teamLeaderId' });
GroupMember.belongsTo(User, { foreignKey: 'userId' });

Task.belongsTo(User, { as: 'assignedTo', foreignKey: 'assignedToId' });
Task.belongsTo(Group, { foreignKey: 'groupId' });

module.exports = { Project, Group, GroupMember, User, Task };
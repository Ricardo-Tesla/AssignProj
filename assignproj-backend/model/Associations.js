const Project = require('./Project');
const Group = require('./Group');
const GroupMember = require('./GroupMember');
const User = require('./Users');

Project.hasMany(Group, { foreignKey: 'projectId' });
Group.belongsTo(Project, { foreignKey: 'projectId' });

Group.hasMany(GroupMember, { foreignKey: 'groupId' });
GroupMember.belongsTo(Group, { foreignKey: 'groupId' });

Group.belongsTo(User, { as: 'teamLeader', foreignKey: 'teamLeaderId' });
GroupMember.belongsTo(User, { foreignKey: 'userId' });

module.exports = { Project, Group, GroupMember, User };
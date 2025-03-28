const express = require('express');
const cors = require('cors');
const { Project, Group, GroupMember, User, Task, Notification, Message, Submission } = require('./model/Associations');
const sequelize = require('./config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createNotification } = require('./utils/createNotification.js');
const upload = require('./config/multer');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');


const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Database initialization
const initializeDatabase = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('Database connected and synced');
  } catch (error) {
    console.error('Database sync error:', error);
    process.exit(1);
  }
};

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Auth routes
app.post('/api/register', async (req, res) => {
  const { username, password, isAdmin } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required'
    });
  }

  try {
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    const user = await User.create({
      username,
      password, // No need to hash here
      isAdmin: isAdmin || false
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    console.log(`Login attempt for username: ${username}`);

    const user = await User.findOne({ where: { username } });

    if (!user) {
      console.log('User not found');
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password);

    if (!isMatch) {
      console.log('Password does not match');
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    const token = jwt.sign(
      { id: user.id, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      success: true,
      token,
      isAdmin: user.isAdmin
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'username', 'isAdmin'] // Include isAdmin in the response
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Search users by username
app.get('/api/users/search', authenticateToken, async (req, res) => {
  const { query } = req.query; // Search query string

  if (!query || query.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Search query must be at least 2 characters'
    });
  }

  try {
    const users = await User.findAll({
      where: {
        username: {
          [Op.like]: `%${query}%` // Use Sequelize operator for LIKE query
        }
      },
      attributes: ['id', 'username'],
      limit: 10 // Limit results to prevent performance issues
    });

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});


// Project creation route
app.post('/api/projects', authenticateToken, async (req, res) => {
  const { title, description, deadline, maxStudents } = req.body;

  try {
    const project = await Project.create({
      title,
      description,
      deadline,
      maxStudents
    });

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: project
    });
  } catch (error) {
    console.error('Project creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Group creation route
app.post('/api/projects/:projectId/groups', authenticateToken, async (req, res) => {
  const { projectId } = req.params;
  const { teamLeaderId, name, memberIds = [] } = req.body;  // Added memberIds array with default empty array

  try {
    // Start a transaction since we'll be making multiple related changes
    const result = await sequelize.transaction(async (t) => {
      // Check if project exists
      const project = await Project.findByPk(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Check if team leader exists
      const teamLeader = await User.findByPk(teamLeaderId);
      if (!teamLeader) {
        throw new Error('Team leader not found');
      }

      // Create the group
      const group = await Group.create({
        projectId,
        teamLeaderId,
        name
      }, { transaction: t });

      // If there are member IDs, verify they exist and create group members
      if (memberIds.length > 0) {
        // Verify all users exist
        const users = await User.findAll({
          where: { id: memberIds },
          transaction: t
        });

        if (users.length !== memberIds.length) {
          throw new Error('One or more member IDs are invalid');
        }

        // Create group members
        await GroupMember.bulkCreate(
          memberIds.map(userId => ({
            groupId: group.id,
            userId
          })),
          { transaction: t }
        );
      }

      return group;
    });

    res.status(201).json({
      success: true,
      message: 'Group created successfully with members',
      data: result
    });

  } catch (error) {
    console.error('Group creation error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// Get single project
app.get('/api/projects/:projectId', authenticateToken, async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get all projects for the current user
app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
      const userId = req.user.id;
      
      // Find projects where user is a member or team leader
      const groups = await GroupMember.findAll({ 
          where: { userId },
          include: [{ model: Group, include: [Project] }]
      });

      const projects = groups.map(g => g.Group.Project);
      
      res.status(200).json({ 
          success: true, 
          data: projects 
      });
  } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/admin/projects', authenticateToken, async (req, res) => {
  try {
      const user = await User.findByPk(req.user.id);
      if (!user || !user.isAdmin) {
          return res.status(403).json({
              success: false,
              message: 'Access denied. Admin privileges required.'
          });
      }

      const projects = await Project.findAll();
      res.status(200).json({ success: true, data: projects });
  } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ success: false, message: 'Server error' });
  }
});


// GET route to retrieve all groups for a specific project
app.get('/api/projects/:projectId/groups', authenticateToken, async (req, res) => {
  const { projectId } = req.params;

  try {
    // Find all groups for the project
    const groups = await Group.findAll({
      where: { projectId },
      include: [
        {
          model: User,
          as: 'teamLeader',
          attributes: ['username'] // Only include username field
        },
        {
          model: GroupMember,
          include: [{
            model: User,
            attributes: ['id', 'username'] // Include username for group members
          }]
        }
      ]
    });

    if (!groups || groups.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No groups found for this project.',
        data: []
      });
    }

    // Format the response to include details for all groups
    const formattedGroups = groups.map(group => ({
      id: group.id,
      name: group.name,
      teamLeader: group.teamLeader ? group.teamLeader : null,
      GroupMembers: group.GroupMembers.map(member => ({
        id: member.id,
        User: member.User
      }))
    }));

    res.status(200).json({
      success: true,
      data: formattedGroups
    });
  } catch (error) {
    console.error('Error retrieving groups:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// GET route to retrieve the current user's group for a specific project
app.get('/api/projects/:projectId/mygroup', authenticateToken, async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id; // Get the logged-in user's ID from the token

  try {
    // First find if the user is a member of any group in this project
    const groupMember = await GroupMember.findOne({
      where: { userId },
      include: [{
        model: Group,
        where: { projectId },
        include: [{
          model: User,
          as: 'teamLeader',
          attributes: ['id', 'username']
        }]
      }]
    });

    if (!groupMember || !groupMember.Group) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'User is not assigned to any group for this project.'
      });
    }

    // Get all members of this group
    const allGroupMembers = await GroupMember.findAll({
      where: { groupId: groupMember.Group.id },
      include: [{
        model: User,
        attributes: ['id', 'username']
      }]
    });

    // Format the response in exactly the structure needed by the frontend
    const formattedGroup = {
      id: groupMember.Group.id,
      name: groupMember.Group.name,
      teamLeader: groupMember.Group.teamLeader ? groupMember.Group.teamLeader.username : null,
      members: allGroupMembers.map(member => member.User.username)
    };

    res.status(200).json({
      success: true,
      data: formattedGroup
    });
  } catch (error) {
    console.error('Error retrieving user group:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get all members of a group with their IDs
app.get('/api/groups/:groupId/members', authenticateToken, async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user.id;

  try {
    // Check if user is either team leader or member of the group
    const isGroupMember = await GroupMember.findOne({
      where: { groupId, userId }
    });

    const group = await Group.findOne({
      where: { id: groupId }
    });

    if (!isGroupMember && group.teamLeaderId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You must be a group member or team leader to view members.'
      });
    }

    // Get all members including the team leader
    const members = await GroupMember.findAll({
      where: { groupId },
      include: [{
        model: User,
        attributes: ['id', 'username']
      }]
    });

    // Format the response to include userId and username
    const formattedMembers = members.map(member => ({
      userId: member.userId,
      username: member.User.username,
      isTeamLeader: member.userId === group.teamLeaderId
    }));

    res.status(200).json({
      success: true,
      data: formattedMembers
    });
  } catch (error) {
    console.error('Error retrieving group members:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// PUT route to update a group
app.put('/api/projects/:projectId/groups/:groupId', authenticateToken, async (req, res) => {
  const { projectId, groupId } = req.params;
  const { name, teamLeaderId, memberIds = [] } = req.body;

  try {
    const result = await sequelize.transaction(async (t) => {
      // Check if group exists and belongs to the project
      const group = await Group.findOne({
        where: {
          id: groupId,
          projectId: projectId
        }
      });

      if (!group) {
        throw new Error('Group not found or does not belong to this project');
      }

      // Update group basic info
      await group.update({
        name: name || group.name,
        teamLeaderId: teamLeaderId || group.teamLeaderId
      }, { transaction: t });

      // If memberIds are provided, update group members
      if (memberIds.length > 0) {
        // Verify all users exist
        const users = await User.findAll({
          where: { id: memberIds },
          transaction: t
        });

        if (users.length !== memberIds.length) {
          throw new Error('One or more member IDs are invalid');
        }

        // Remove existing members
        await GroupMember.destroy({
          where: { groupId: group.id },
          transaction: t
        });

        // Add new members
        await GroupMember.bulkCreate(
          memberIds.map(userId => ({
            groupId: group.id,
            userId
          })),
          { transaction: t }
        );
      }

      // Fetch updated group with members
      const updatedGroup = await Group.findByPk(groupId, {
        include: [
          {
            model: User,
            as: 'teamLeader',
            attributes: ['username']
          },
          {
            model: GroupMember,
            include: [{
              model: User,
              attributes: ['username']
            }]
          }
        ],
        transaction: t
      });

      return updatedGroup;
    });

    res.status(200).json({
      success: true,
      message: 'Group updated successfully',
      data: result
    });

  } catch (error) {
    console.error('Group update error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});


// Middleware to check if user is team leader of the group
const isTeamLeader = async (req, res, next) => {
  const { groupId } = req.params;
  const userId = req.user.id;

  try {
    const group = await Group.findOne({
      where: {
        id: groupId,
        teamLeaderId: userId
      }
    });

    if (!group) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only team leaders can perform this action.'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Create a task for a group
app.post('/api/groups/:groupId/tasks', authenticateToken, isTeamLeader, async (req, res) => {
  const { groupId } = req.params;
  const { title, description, assignedToId, dueDate } = req.body;

  try {
    const result = await sequelize.transaction(async (t) => {
      // Verify that assignedTo user is a member of the group
      const groupMember = await GroupMember.findOne({
        where: {
          groupId,
          userId: assignedToId
        }
      });

      if (!groupMember) {
        throw new Error('Assigned user is not a member of this group');
      }

      const task = await Task.create({
        groupId,
        assignedToId,
        title,
        description,
        dueDate
      }, { transaction: t });

      // Create notification for assigned user
      await createNotification(
        'task',
        `You have been assigned a new task: ${title}`,
        assignedToId, // Recipient
        groupId, // Group ID
        task.id, // Task ID
        t, // Transaction
        req.user.id // Created by (the team leader who assigned the task)
      );

      return task;
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: result
    });
  } catch (error) {
    console.error('Task creation error:', error);
    res.status(error.message.includes('not a member') ? 400 : 500).json({
      success: false,
      message: error.message || 'Server error'
    });
  }
});

// Get all tasks for a group
app.get('/api/groups/:groupId/tasks', authenticateToken, async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user.id;
  const isAdmin = req.user.isAdmin; // Assuming `isAdmin` is included in the token payload

  try {
    // Check if the user is an admin
    if (isAdmin) {
      // Admins can view tasks for any group
      const tasks = await Task.findAll({
        where: { groupId },
        include: [{
          model: User,
          as: 'assignedTo',
          attributes: ['username']
        }]
      });

      return res.status(200).json({
        success: true,
        data: tasks
      });
    }

    // For non-admin users, check if they are a group member or team leader
    const isGroupMember = await GroupMember.findOne({
      where: { groupId, userId }
    });

    const group = await Group.findOne({
      where: { id: groupId }
    });

    if (!isGroupMember && group.teamLeaderId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You must be a group member, team leader, or admin to view tasks.'
      });
    }

    // Fetch tasks for the group
    const tasks = await Task.findAll({
      where: { groupId },
      include: [{
        model: User,
        as: 'assignedTo',
        attributes: ['username']
      }]
    });

    res.status(200).json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('Error retrieving tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});


// Update task status (team leader only)
app.patch('/api/tasks/:taskId/status', authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body; // Expected values: "in_progress", "completed"
  const userId = req.user.id;

  if (!['in_progress', 'completed'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status. Allowed values are "in_progress" or "completed".'
    });
  }

  try {
    // Check if task exists and get its details
    const task = await Task.findOne({
      where: { id: taskId },
      include: [{ model: Group }]
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check if the user is the team leader
    if (task.Group.teamLeaderId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the team leader can update the task status'
      });
    }

    // Update the task status
    await task.update({ status });

    // If the task is marked as "completed", update all related submissions to "Reviewed"
    if (status === 'completed') {
      await Submission.update(
        { status: 'Reviewed' }, // Update submission status to "Reviewed"
        { where: { taskId } }
      );
    }

    res.status(200).json({
      success: true,
      message: `Task status updated to "${status}"`,
      data: { task }
    });

  } catch (error) {
    console.error('Task status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Delete a task
app.delete('/api/groups/:groupId/tasks/:taskId', authenticateToken, isTeamLeader, async (req, res) => {
  const { groupId, taskId } = req.params;

  try {
    const task = await Task.findOne({
      where: {
        id: taskId,
        groupId
      }
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    await task.destroy();

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Task deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});


// Project-wide notification endpoint
app.post('/api/projects/:projectId/notifications', authenticateToken, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const notifications = await sequelize.transaction(async (t) => {
      const project = await Project.findByPk(req.params.projectId, { transaction: t });
      if (!project) throw new Error('Project not found');

      const groups = await Group.findAll({
        where: { projectId: project.id },
        include: [GroupMember],
        transaction: t
      });

      const recipients = new Set();
      groups.forEach(group => {
        group.GroupMembers.forEach(member => recipients.add(member.userId));
        if (group.teamLeaderId) recipients.add(group.teamLeaderId);
      });

      const notifications = [];
      for (const userId of recipients) {
        const notification = await createNotification(
          'project',
          message,
          userId, // Recipient
          null, // Group ID
          null, // Task ID
          t, // Transaction
          req.user.id // Created by (the admin who sent the notification)
        );
        notifications.push(notification);
      }

      return notifications;
    });

    res.status(201).json({
      success: true,
      count: notifications.length,
      notifications: notifications.map(n => ({ id: n.id, userId: n.userId }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Group-specific notification endpoint
app.post('/api/projects/:projectId/groups/:groupId/notifications', authenticateToken, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const notifications = await sequelize.transaction(async (t) => {
      const group = await Group.findOne({
        where: {
          id: req.params.groupId,
          projectId: req.params.projectId
        },
        include: [GroupMember],
        transaction: t
      });
      if (!group) throw new Error('Group not found');

      const recipients = new Set(group.GroupMembers.map(m => m.userId));
      if (group.teamLeaderId) recipients.add(group.teamLeaderId);

      const notifications = [];
      for (const userId of recipients) {
        const notification = await createNotification(
          'group',
          message,
          userId, // Recipient
          group.id, // Group ID
          null, // Task ID
          t, // Transaction
          req.user.id // Created by (the admin who sent the notification)
        );
        notifications.push(notification);
      }

      return notifications;
    });

    res.status(201).json({
      success: true,
      count: notifications.length,
      notifications: notifications.map(n => ({ id: n.id, userId: n.userId }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User-specific notification endpoint
app.post('/api/projects/:projectId/users/:userId/notifications', authenticateToken, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const notification = await sequelize.transaction(async (t) => {
      // Verify user belongs to project
      const user = await User.findOne({
        where: { id: req.params.userId },
        include: [{
          model: GroupMember,
          include: [{
            model: Group,
            where: { projectId: req.params.projectId }
          }]
        }],
        transaction: t
      });
      if (!user || !user.GroupMembers?.length) {
        throw new Error('User not found in project');
      }

      return await createNotification(
        'individual',
        message,
        user.id, // Recipient
        null, // Group ID
        null, // Task ID
        t, // Transaction
        req.user.id // Created by (the admin who sent the notification)
      );
    });

    res.status(201).json({
      success: true,
      notification: {
        id: notification.id,
        userId: notification.userId,
        message: notification.message
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/sent-notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await Notification.findAndCountAll({
      include: [
        {
          model: User,
          as: 'Recipient',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'Creator',
          attributes: ['id', 'username']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    res.json({
      success: true,
      count: notifications.count,
      data: notifications.rows
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
});


// Backend Notification Fetch Route 
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: Task,
          attributes: ['id', 'title', 'description'],
          include: [{
            model: Group,
            attributes: ['id', 'name', 'projectId']
          }]
        },
        {
          model: Group,
          attributes: ['id', 'name', 'projectId']
        }
      ],
      order: [['createdAt', 'DESC']],
      logging: console.log  // This will log the generated SQL query
    });

    // Log raw notifications before sending
    console.log('Raw Notifications:', JSON.stringify(notifications, null, 2));

    res.status(200).json({
      success: true,
      data: notifications.map(notification => ({
        id: notification.id,
        message: notification.message,
        type: notification.type,
        createdAt: notification.createdAt,
        task: notification.Task ? {
          id: notification.Task.id,
          title: notification.Task.title,
          group: notification.Task.Group ? {
            id: notification.Task.Group.id,
            name: notification.Task.Group.name,
            projectId: notification.Task.Group.projectId
          } : null
        } : null,
        group: notification.Group ? {
          id: notification.Group.id,
          name: notification.Group.name,
          projectId: notification.Group.projectId
        } : null
      }))
    });
  } catch (error) {
    console.error('Notification fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get notifications created by admin users
app.get('/api/admin/sent-notifications', authenticateToken, async (req, res) => {
  try {
    // First check if the requesting user is an admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Build filter conditions
    let whereClause = {
      createdBy: req.user.id  // This assumes your Notification model has a createdBy field
    };

    // Optional filters
    const { userId, groupId, type } = req.query;
    if (userId) whereClause.userId = userId;
    if (groupId) whereClause.groupId = groupId;
    if (type) whereClause.type = type;

    // Build includes for related models
    const includeModels = [
      {
        model: Task,
        attributes: ['title', 'description', 'dueDate']
      },
      {
        model: Group,
        attributes: ['name']
      },
      {
        model: User,
        as: 'Recipient',  // Assuming you have an alias for the recipient relationship
        attributes: ['username']  // Removed 'email' field
      }
    ];

    // Get notifications
    const notifications = await Notification.findAll({
      where: whereClause,
      include: includeModels,
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications
    });

  } catch (error) {
    console.error('Error retrieving admin sent notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});


// Mark notification as read
app.patch('/api/notifications/:notificationId', authenticateToken, async (req, res) => {
  const { notificationId } = req.params;

  try {
    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        userId: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.update({ isRead: true });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Chat routes
app.post('/api/groups/:groupId/messages', authenticateToken, async (req, res) => {
  const { groupId } = req.params;
  const { content } = req.body;
  const senderId = req.user.id;

  try {
    // Log the incoming data
    console.log('Saving message:', { content, groupId, senderId });

    // Check if user is a member of the group or team leader
    const isGroupMember = await GroupMember.findOne({
      where: { groupId, userId: senderId }
    });

    const group = await Group.findOne({
      where: { id: groupId }
    });

    if (!isGroupMember && group.teamLeaderId !== senderId) {
      return res.status(403).json({
        success: false,
        message: 'Only group members can send messages'
      });
    }

    // Create the message
    const message = await Message.create({
      content,
      groupId,
      senderId,
      timestamp: new Date()
    });

    // Fetch the created message with sender information
    const messageWithSender = await Message.findOne({
      where: { id: message.id },
      include: [{
        model: User,
        as: 'sender',
        attributes: ['username']
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: messageWithSender
    });
  } catch (error) {
    console.error('Message saving error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});


// Fetch groups the user is a member of
app.get('/api/user/groups', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
      const groups = await Group.findAll({
          include: [
              {
                  model: GroupMember,
                  where: { userId },
                  attributes: [] // Exclude GroupMember details
              }
          ],
          attributes: ['id', 'name'] // Only return group ID and name
      });

      res.status(200).json({
          success: true,
          data: groups
      });
  } catch (error) {
      console.error('Error fetching user groups:', error);
      res.status(500).json({
          success: false,
          message: 'Failed to fetch groups'
      });
  }
});


app.get('/api/groups/:groupId/messages', authenticateToken, async (req, res) => {
  const { groupId } = req.params;
  const userId = req.user.id;
  const { limit = 50, before } = req.query; // Pagination parameters

  try {
    // Check if user is a member of the group or team leader
    const isGroupMember = await GroupMember.findOne({
      where: { groupId, userId }
    });

    const group = await Group.findOne({
      where: { id: groupId }
    });

    if (!isGroupMember && group.teamLeaderId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only group members can view messages'
      });
    }

    // Build query conditions
    const whereConditions = { groupId };

    if (before) {
      whereConditions.timestamp = {
        [Op.lt]: new Date(before)
      };
    }

    // Fetch messages with sender information
    const messages = await Message.findAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['username']
        }
      ],
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit)
    });

    res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Error retrieving messages:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Delete a message (only sender can delete their own messages)
app.delete('/api/groups/:groupId/messages/:messageId', authenticateToken, async (req, res) => {
  const { groupId, messageId } = req.params;
  const userId = req.user.id;

  try {
    const message = await Message.findOne({
      where: {
        id: messageId,
        groupId,
        senderId: userId
      }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or you are not authorized to delete it'
      });
    }

    await message.destroy();

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Message deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});



// Submit a file for a task
app.post('/api/tasks/:taskId/submissions',
  authenticateToken,
  upload.single('file'),
  async (req, res) => {
    const { taskId } = req.params;
    const { comments } = req.body;
    const submitterId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    try {
      // Check if task exists and get its details
      const task = await Task.findOne({
        where: { id: taskId },
        include: [{ model: Group }]
      });

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task not found'
        });
      }

      // Check if user is a member of the group
      const isGroupMember = await GroupMember.findOne({
        where: {
          groupId: task.Group.id,
          userId: submitterId
        }
      });

      if (!isGroupMember && task.Group.teamLeaderId !== submitterId) {
        return res.status(403).json({
          success: false,
          message: 'Only group members can submit files'
        });
      }

      // Check if submission is late
      const isLate = new Date() > new Date(task.dueDate);

      // Create submission record
      const submission = await Submission.create({
        taskId,
        submitterId,
        fileName: req.file.originalname,
        fileUrl: req.file.path,
        submissionTime: new Date(),
        isLate,
        comments,
        status: 'Submitted' // Set submission status to "Submitted"
      });

      // Update task status to "in_progress" if it is still "pending"
      if (task.status === 'pending') {
        await task.update({ status: 'in_progress' });
      }

      // Notify group members and professor about the submission
      const groupMembers = await GroupMember.findAll({
        where: { groupId: task.Group.id }
      });

      // Get all users who should be notified (group members + team leader)
      const notifyUsers = [...groupMembers, { userId: task.Group.teamLeaderId }]
        .filter(user => user.userId !== submitterId);

      // Create notifications
      await Promise.all(
        notifyUsers.map(user =>
          createNotification(
            'submission',
            `New submission for task: ${task.title}`,
            user.userId, // Recipient
            task.Group.id, // Group ID
            taskId, // Task ID
            null, // Transaction (if applicable)
            submitterId // Created by (the user who submitted the file)
          )
        )
      );

      res.status(201).json({
        success: true,
        message: 'File submitted successfully',
        data: {
          submission,
          taskStatus: task.status,
          submissionStatus: 'Submitted'
        }
      });

    } catch (error) {
      console.error('File submission error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      });
    }
  });



// Get all submissions for a specific project (via tasks)
app.get('/api/projects/:projectId/submissions', authenticateToken, async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;

  try {
      // Verify user is part of the project
      const userGroups = await GroupMember.findAll({
          where: { userId },
          include: [{
              model: Group,
              where: { projectId },
              include: [Task]
          }]
      });

      if (!userGroups.length) {
          return res.status(403).json({
              success: false,
              message: 'Not enrolled in any group for this project'
          });
      }

      // Get all task IDs from user's groups
      const taskIds = userGroups.flatMap(group => 
          group.Group.Tasks.map(task => task.id)
      );

      // Fetch user's submissions for these tasks
      const submissions = await Submission.findAll({
          where: { 
              taskId: taskIds,
              submitterId: userId
          },
          include: [
              {
                  model: Task,
                  attributes: ['title', 'dueDate']
              }
          ]
      });

      res.status(200).json({
          success: true,
          submissions: submissions.map(s => ({
              task: s.Task.title,
              dueDate: s.Task.dueDate,
              sharedFile: s.fileUrl,
              submissionTime: s.submissionTime,
              status: s.status
          }))
      });

  } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all submissions for a specific group within a project
app.get('/api/projects/:projectId/groups/:groupId/submissions', authenticateToken, async (req, res) => {
  const { projectId, groupId } = req.params;
  const userId = req.user.id;

  try {
    // Check if the user is a member of the group or the team leader
    const isGroupMember = await GroupMember.findOne({
      where: { groupId, userId }
    });

    const group = await Group.findOne({
      where: { id: groupId, projectId } // Ensure the group belongs to the project
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found in the specified project'
      });
    }

    // If the user is an admin, only allow access to submissions with status "Reviewed"
    const user = await User.findByPk(userId);
    const statusFilter = user.isAdmin ? { status: 'Reviewed' } : {};

    if (!isGroupMember && group.teamLeaderId !== userId && !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You must be a group member, team leader, or admin to view submissions.'
      });
    }

    // Fetch submissions for the group within the project
    const submissions = await Submission.findAll({
      where: {
        '$Task.groupId$': groupId,
        ...statusFilter // Apply the status filter for admins
      },
      include: [
        {
          model: Task,
          attributes: ['id', 'title', 'dueDate', 'status']
        },
        {
          model: User,
          as: 'submitter',
          attributes: ['id', 'username']
        }
      ],
      order: [['submissionTime', 'DESC']]
    });

    res.status(200).json({
      success: true,
      data: submissions
    });
  } catch (error) {
    console.error('Error fetching group submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});



// Get all submissions for the admin
app.get('/api/admin/submissions', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // Check if the user is an admin
    const user = await User.findByPk(userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Extract optional filters from query parameters
    const { projectId, groupId, taskId, status } = req.query;

    // Build the filter conditions
    const whereConditions = {};
    if (status) whereConditions.status = status;
    if (taskId) whereConditions.taskId = taskId;

    // Include models for filtering and data enrichment
    const includeModels = [
      {
        model: Task,
        attributes: ['id', 'title', 'dueDate', 'status'],
        include: [
          {
            model: Group,
            attributes: ['id', 'name', 'projectId'],
            include: [
              {
                model: Project,
                attributes: ['id', 'title']
              }
            ]
          }
        ]
      },
      {
        model: User,
        as: 'submitter',
        attributes: ['id', 'username']
      }
    ];

    // Add group and project filters if provided
    if (groupId) {
      includeModels[0].include[0].where = { id: groupId };
    }
    if (projectId) {
      includeModels[0].include[0].include[0].where = { id: projectId };
    }

    // Fetch submissions
    const submissions = await Submission.findAll({
      where: whereConditions,
      include: includeModels,
      order: [['submissionTime', 'DESC']]
    });

    // Format the response
    const formattedSubmissions = submissions.map(submission => ({
      id: submission.id,
      fileName: submission.fileName,
      fileUrl: submission.fileUrl,
      submissionTime: submission.submissionTime,
      status: submission.status,
      isLate: submission.isLate,
      task: submission.Task ? {
        id: submission.Task.id,
        title: submission.Task.title,
        dueDate: submission.Task.dueDate,
        status: submission.Task.status
      } : null,
      group: submission.Task && submission.Task.Group ? {
        id: submission.Task.Group.id,
        name: submission.Task.Group.name,
        project: submission.Task.Group.Project ? {
          id: submission.Task.Group.Project.id,
          title: submission.Task.Group.Project.title
        } : null
      } : null,
      submitter: submission.submitter ? {
        id: submission.submitter.id,
        username: submission.submitter.username
      } : null
    }));

    res.status(200).json({
      success: true,
      data: formattedSubmissions
    });
  } catch (error) {
    console.error('Error fetching submissions for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Download a submission file
app.get('/api/submissions/:submissionId/download', authenticateToken, async (req, res) => {
  const { submissionId } = req.params;
  const userId = req.user.id;

  try {
    const submission = await Submission.findOne({
      where: { id: submissionId },
      include: [{
        model: Task,
        include: [{ model: Group }]
      }]
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Check authorization
    const isGroupMember = await GroupMember.findOne({
      where: {
        groupId: submission.Task.Group.id,
        userId
      }
    });

    const user = await User.findByPk(userId);

    // Admins can only download files with status "Reviewed"
    if (user.isAdmin && submission.status !== 'Reviewed') {
      return res.status(403).json({
        success: false,
        message: 'Admins can only download files with status "Reviewed".'
      });
    }

    if (!isGroupMember &&
      submission.Task.Group.teamLeaderId !== userId &&
      !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to download this file'
      });
    }

    const filePath = path.join(__dirname, submission.fileUrl);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    res.download(filePath, submission.fileName);

  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});



// Initialize the database and start the server
const startServer = async () => {
  try {
      // Sync the database without altering existing constraints
      await sequelize.sync({ alter: false });
      console.log('Database synced successfully.');

      // Start the server
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => {
          console.log(`Server is running on ${PORT}`);
      });
  } catch (error) {
      console.error('Error initializing the database:', error);
  }
};

startServer();
const express = require('express');
const cors = require('cors');
const { Project, Group, GroupMember, User, Task } = require('./model/Associations');
const sequelize = require('./config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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

    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = await User.create({
      username,
      password: hashedPassword,
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
    const user = await User.findOne({ where: { username } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password);

    if (!isMatch) {
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
      token
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

// Modified GET route to retrieve groups for a specific project
app.get('/api/projects/:projectId/groups', authenticateToken, async (req, res) => {
  const { projectId } = req.params;

  try {
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
            attributes: ['username'] // Only include username for group members too
          }]
        }
      ]
    });

    res.status(200).json({
      success: true,
      data: groups
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

// Create a new task
app.post('/api/groups/:groupId/tasks', authenticateToken, isTeamLeader, async (req, res) => {
  const { groupId } = req.params;
  const { title, description, assignedToId, dueDate } = req.body;

  try {
    // Verify that assignedTo user is a member of the group
    const groupMember = await GroupMember.findOne({
      where: {
        groupId,
        userId: assignedToId
      }
    });

    if (!groupMember) {
      return res.status(400).json({
        success: false,
        message: 'Assigned user is not a member of this group'
      });
    }

    const task = await Task.create({
      groupId,
      assignedToId,
      title,
      description,
      dueDate
    });

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: task
    });
  } catch (error) {
    console.error('Task creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get all tasks for a group
app.get('/api/groups/:groupId/tasks', authenticateToken, async (req, res) => {
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
        message: 'Access denied. You must be a group member or team leader to view tasks.'
      });
    }

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

// Update a task
app.put('/api/groups/:groupId/tasks/:taskId', authenticateToken, isTeamLeader, async (req, res) => {
  const { groupId, taskId } = req.params;
  const { title, description, assignedToId, status, dueDate } = req.body;

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

    if (assignedToId) {
      // Verify that new assignedTo user is a member of the group
      const groupMember = await GroupMember.findOne({
        where: {
          groupId,
          userId: assignedToId
        }
      });

      if (!groupMember) {
        return res.status(400).json({
          success: false,
          message: 'Assigned user is not a member of this group'
        });
      }
    }

    await task.update({
      title: title || task.title,
      description: description || task.description,
      assignedToId: assignedToId || task.assignedToId,
      status: status || task.status,
      dueDate: dueDate || task.dueDate
    });

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: task
    });
  } catch (error) {
    console.error('Task update error:', error);
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

// Start the server
const startServer = async () => {
  await initializeDatabase();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();
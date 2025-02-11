const express = require('express');
const { Project, Group, GroupMember, User } = require('../model/Associations');
const { authenticateToken, authorizeAdmin } = require('../middleware/AuthMiddleware');

const router = express.Router();

// Create a project (Admin only)
router.post('/', authenticateToken, authorizeAdmin, async (req, res) => {
  const { title, description, deadline, maxStudents } = req.body;

  if (!title || !description || !deadline || !maxStudents) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }

  try {
    const project = await Project.create({
      title,
      description,
      deadline,
      maxStudents,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: project
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating project',
      error: error.message
    });
  }
});

// Create a group for a project (Admin only)
router.post('/:projectId/groups', authenticateToken, authorizeAdmin, async (req, res) => {
  const { teamLeaderId, memberIds } = req.body;
  const { projectId } = req.params;

  try {
    // Verify project exists
    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Verify team leader exists and is not an admin
    const teamLeader = await User.findOne({
      where: { id: teamLeaderId, isAdmin: false }
    });
    if (!teamLeader) {
      return res.status(400).json({
        success: false,
        message: 'Invalid team leader'
      });
    }

    // Create group
    const group = await Group.create({
      projectId,
      teamLeaderId
    });

    // Add members to group
    const memberPromises = memberIds.map(userId =>
      GroupMember.create({
        groupId: group.id,
        userId
      })
    );
    await Promise.all(memberPromises);

    // Fetch complete group data with members
    const completeGroup = await Group.findByPk(group.id, {
      include: [
        {
          model: User,
          as: 'teamLeader',
          attributes: ['id', 'username']
        },
        {
          model: GroupMember,
          include: [{
            model: User,
            attributes: ['id', 'username']
          }]
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: completeGroup
    });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating group',
      error: error.message
    });
  }
});

// Get project groups
router.get('/:projectId/groups', authenticateToken, async (req, res) => {
  try {
    const groups = await Group.findAll({
      where: { projectId: req.params.projectId },
      include: [
        {
          model: User,
          as: 'teamLeader',
          attributes: ['id', 'username']
        },
        {
          model: GroupMember,
          include: [{
            model: User,
            attributes: ['id', 'username']
          }]
        }
      ]
    });

    res.status(200).json({
      success: true,
      data: groups
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching groups',
      error: error.message
    });
  }
});

// Update group members or leader (Admin only)
router.put('/:projectId/groups/:groupId', authenticateToken, authorizeAdmin, async (req, res) => {
  const { teamLeaderId, memberIds } = req.body;
  const { groupId } = req.params;

  try {
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Update team leader if provided
    if (teamLeaderId) {
      await group.update({ teamLeaderId });
    }

    // Update members if provided
    if (memberIds) {
      // Remove existing members
      await GroupMember.destroy({ where: { groupId } });
      
      // Add new members
      const memberPromises = memberIds.map(userId =>
        GroupMember.create({
          groupId,
          userId
        })
      );
      await Promise.all(memberPromises);
    }

    // Fetch updated group data
    const updatedGroup = await Group.findByPk(groupId, {
      include: [
        {
          model: User,
          as: 'teamLeader',
          attributes: ['id', 'username']
        },
        {
          model: GroupMember,
          include: [{
            model: User,
            attributes: ['id', 'username']
          }]
        }
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Group updated successfully',
      data: updatedGroup
    });
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating group',
      error: error.message
    });
  }
});

module.exports = router;
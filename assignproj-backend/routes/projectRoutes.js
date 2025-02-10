const express = require('express');
const Project = require('../model/Project');
const { authenticateToken, authorizeAdmin } = require('../middleware/AuthMiddleware');

const router = express.Router();

// Create a project (Only Admin/Professor)
router.post('/create', authenticateToken, authorizeAdmin, async (req, res) => {
  const { title, description } = req.body;

  if (!title || !description) {
    return res.status(400).json({
      success: false,
      message: 'Title and description are required'
    });
  }

  try {
    const project = await Project.create({ title, description });

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;

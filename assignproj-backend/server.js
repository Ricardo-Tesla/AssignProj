require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const sequelize = require('./config/database');
const User = require('./model/Users');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database Sync
sequelize.sync({ alter: true }) // Use alter to modify existing table
  .then(() => console.log('Database connected and synced'))
  .catch(err => console.error('Database sync error:', err));


app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    const user = await User.create({ username, password });

    res.status(201).json({
      success: true,
      user: { id: user.id, username: user.username }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Login Endpoint
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

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    // Assuming you are using JWT for token generation
    const token = jwt.sign({ id: user.id }, '0987654321', { expiresIn: '1h' });

    res.status(200).json({
      success: true,
      token
    });
  } catch (error) {
    console.error('Login error:', error); // Log the error stack
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});



// Protected Route
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({ message: 'This is protected data', user: req.user });
});

// Middleware to authenticate JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
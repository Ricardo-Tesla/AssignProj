require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const projectRoutes = require('./routes/projectRoutes');
const sequelize = require('./config/database');
const User = require('./model/Users');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database Sync (Remove alter: true after initial setup)
sequelize.sync()
  .then(() => console.log('Database connected and synced'))
  .catch(err => console.error('Database sync error:', err));


//register
app.post('/api/register', async (req, res) => {
  const { username, password, isAdmin } = req.body;

  if (!username || !password) {
    return res.status(400).json({ 
      message: 'Username and password are required' 
    });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ 
        message: 'Username already exists' 
      });
    }

    // Create new user - the model will handle password hashing
    const user = await User.create({
      username,
      password,
      isAdmin: isAdmin || false
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Login User
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  console.log(`Login attempt: ${username}`); // Debug log

  try {
    const user = await User.findOne({ where: { username } });

    if (!user) {
      console.log('User not found');
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    console.log(`Stored hashed password: ${user.password}`); // Debug log

    // Compare password
    const isMatch = bcrypt.compareSync(password, user.password);
    console.log(`Password match: ${isMatch}`); // Debug log

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user.id, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log(`Generated Token: ${token}`); // Debug log

    res.status(200).json({ success: true, token });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
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

// Routes
app.use('/api/projects', projectRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const express = require ('express');
const cors= require('cors');
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// dummy users database
const users = [
    {id: 1, username: 'rica', password: 'password123'},
    {id: 2, username: 'admin', password: 'password123'}
];

// login endpoint
app.post('/api/login', (req, res) => {
    const {username, password}= req.body;

    // find user
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username
            },
            token: 'dummy-token-' + user.id //simulate jwt token
        });

    } else{
        res.status(401).json({
            success: false,
            message: 'Invalid username or password'
        });
    }
});

// Protected route example
app.get('/api/protected', (req, res) => {
    // This is a dummy protected route
    // In a real app, you would verify the JWT token here
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer dummy-token-')) {
        res.json({ 
            message: 'This is protected data' 
        });
    } else {
        res.status(401).json({ 
            message: 'Unauthorized' 
        });
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies (body-parser)
app.use(express.json());

// In-memory data store for demonstration purposes
let users = [];
let nextUserId = 1;

// GET /api/users - Returns all users
// As per the task, this will return an empty array initially.
app.get('/api/users', (req, res) => {
  res.json(users);
});

// POST /api/users - Creates a new user
app.post('/api/users', (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  const newUser = {
    id: nextUserId++,
    name: name,
    email: email,
  };

  users.push(newUser);

  // Respond with the newly created user object
  res.status(201).json(newUser);
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

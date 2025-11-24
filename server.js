const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Define the GET endpoint /api/hello
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello, World from AI Agent!' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

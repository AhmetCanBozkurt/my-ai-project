const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// GET /api/hello endpoint'i
app.get('/api/hello', (req, res) => {
  res.send('Hello, World from AI Agent!');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

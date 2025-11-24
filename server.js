const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Endpoint: GET /api/hello
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello, World from AI Agent!' });
});

// Sunucuyu başlat
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

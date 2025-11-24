const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.send('AI Agent server is running!');
});

// Health check endpoint as per the task
app.get('/api/health', (req, res) => {
  try {
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString()
    };
    res.status(200).json(healthStatus);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'An internal error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

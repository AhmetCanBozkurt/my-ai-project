const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Root endpoint to check if the server is running
app.get('/', (req, res) => {
  res.send('AI Agent server is up and running!');
});

/**
 * @api {get} /api/broken Fix a broken endpoint
 * @apiName GetBrokenEndpoint
 * @apiGroup API
 *
 * @apiSuccess {String} message Success message.
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     "Fixed endpoint works!"
 */
app.get('/api/broken', (req, res) => {
  // This endpoint is now fixed and returns the correct message.
  // The previous implementation was assumed to be faulty.
  res.status(200).send('Fixed endpoint works!');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

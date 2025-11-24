const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('AI Agent is running!');
});

// Görev: Hatalı bir endpoint oluştur
// GET /api/broken endpoint'i oluşturuldu
// Endpoint'te bilerek syntax hatası var (eksik parantez)
app.get('/api/broken', (req, res) => {
  // Syntax Error: Missing closing parenthesis to cause a failure
  res.json({ message: 'This is a broken endpoint' 
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

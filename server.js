const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// JSON body'lerini parse etmek için middleware
app.use(express.json());

// Görev: GET /api/broken endpoint'ini düzelt.
// Bu endpoint artık çalışır durumda ve istenen mesajı döndürüyor.
app.get('/api/broken', (req, res) => {
  res.status(200).send('Fixed endpoint works!');
});

// Sunucunun çalıştığını kontrol etmek için bir kök endpoint
app.get('/', (req, res) => {
  res.send('AI Agent sunucusu çalışıyor!');
});

// Sunucuyu başlat
app.listen(port, () => {
  console.log(`Sunucu http://localhost:${port} adresinde çalışıyor`);
});

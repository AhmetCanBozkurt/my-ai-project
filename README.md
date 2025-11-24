# ☁️ Cloud AI Developer

Bu proje, bilgisayarınızın donanımını (CPU/RAM) kullanmadan, tamamen **GitHub Actions** ve **Google Gemini API** (ücretsiz) kullanarak kod yazan, PR açan otomatik bir yazılım ajanıdır.

## 🚀 Özellikler

- ✅ **Tamamen bulut tabanlı** - Yerel donanım kullanmaz
- ✅ **Ücretsiz** - Google Gemini API'nin ücretsiz tier'ını kullanır
- ✅ **Otomatik PR** - Değişiklikler otomatik olarak Pull Request olarak açılır
- ✅ **GitHub Actions** - Her değişiklikte otomatik çalışır
- ✅ **Kolay kullanım** - Sadece `tasks/active-task.md` dosyasına görev yazın

## 📂 Proje Yapısı

```
my-ai-project/
├── .github/
│   └── workflows/
│       └── ai-developer.yml   # Otomasyonu tetikleyen GitHub Action
├── scripts/
│   └── ai-agent.js            # API ile konuşan Node.js betiği
├── tasks/
│   └── active-task.md         # AI'ya vereceğiniz görev dosyası
├── package.json               # Gerekli kütüphaneler
└── README.md
```

## 🛠️ Kurulum

### 1. Google Gemini API Key Alın

1. [Google AI Studio](https://makersuite.google.com/app/apikey) adresine gidin
2. "Create API Key" butonuna tıklayın
3. API key'inizi kopyalayın (ücretsizdir)

### 2. GitHub Repository Oluşturun

1. Bu projeyi GitHub'a push edin
2. Repository Settings > Secrets and variables > Actions'a gidin
3. Yeni bir secret ekleyin:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** Google Gemini API key'iniz

### 3. İlk Çalıştırma

1. `tasks/active-task.md` dosyasını açın
2. Yapmak istediğiniz görevi yazın
3. Değişiklikleri commit edin ve push edin
4. GitHub Actions otomatik olarak çalışacak ve PR açacak

## 📝 Kullanım

### Görev Ekleme

`tasks/active-task.md` dosyasını düzenleyin ve görevinizi yazın:

```markdown
## Şu Anki Görev:

Projeye yeni bir hello world endpoint ekle:
- GET /api/hello endpoint'i oluştur
- "Hello, World!" mesajı döndürsün
- Express.js kullan
```

### GitHub Actions'ı Tetikleme

GitHub Actions şu durumlarda otomatik çalışır:

1. **Manuel tetikleme:** Actions sekmesinden "AI Developer Agent" workflow'unu çalıştırın
2. **Otomatik:** `tasks/active-task.md` dosyası değiştiğinde
3. **Zamanlanmış:** Her gün saat 00:00 UTC'de (isteğe bağlı)

### Pull Request İnceleme

AI Agent görevi tamamladıktan sonra otomatik olarak bir PR açacaktır:

1. GitHub'da PR'ı kontrol edin
2. Değişiklikleri gözden geçirin
3. Onaylayın ve merge edin

## ⚙️ Yapılandırma

### GitHub Actions Zamanlaması

`.github/workflows/ai-developer.yml` dosyasında cron job'ı düzenleyebilirsiniz:

```yaml
schedule:
  - cron: '0 0 * * *'  # Her gün saat 00:00 UTC
```

### AI Model Değiştirme

`scripts/ai-agent.js` dosyasında model adını değiştirebilirsiniz:

```javascript
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
// veya
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
```

## 🔒 Güvenlik

- API key'lerinizi asla kod içine yazmayın
- GitHub Secrets kullanın
- PR'ları merge etmeden önce mutlaka gözden geçirin

## 📚 Örnek Görevler

### 1. Yeni API Endpoint
```
Projeye yeni bir REST API endpoint ekle:
- GET /api/users endpoint'i oluştur
- Kullanıcı listesini döndür
- Express.js kullan
```

### 2. Yeni Component
```
React ile yeni bir buton component'i oluştur:
- Farklı renk varyasyonları (primary, secondary)
- Loading state desteği
- TypeScript kullan
```

### 3. Bug Fix
```
Login formundaki email validasyon hatasını düzelt:
- Geçerli email formatı kontrolü ekle
- Hata mesajlarını göster
```

## 🐛 Sorun Giderme

### AI Agent çalışmıyor

1. GitHub Actions loglarını kontrol edin
2. `GEMINI_API_KEY` secret'ının doğru tanımlandığından emin olun
3. API key'inizin geçerli olduğunu kontrol edin

### PR açılmıyor

1. GitHub Actions'ın başarıyla tamamlandığını kontrol edin
2. `GITHUB_TOKEN` permission'larını kontrol edin
3. Branch protection kurallarını kontrol edin

## 📄 Lisans

MIT

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📞 Destek

Sorularınız için GitHub Issues kullanabilirsiniz.

---

**Not:** Bu proje eğitim amaçlıdır. Production ortamında kullanmadan önce güvenlik ve test süreçlerini ekleyin.


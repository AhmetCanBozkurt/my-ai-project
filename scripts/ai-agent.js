#!/usr/bin/env node

/**
 * Cloud AI Developer Agent
 * Google Gemini API kullanarak kod yazan otomatik ajan
 * v1beta REST API kullanarak SDK bağımsız çalışır
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// ⚙️ AYARLAR
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-1.5-flash"; 
const API_VERSION = "v1beta"; 

if (!API_KEY) {
    console.error("❌ HATA: GEMINI_API_KEY environment variable tanımlı değil!");
    console.error("💡 GitHub Repository > Settings > Secrets and variables > Actions > GEMINI_API_KEY ekleyin");
    process.exit(1);
}

// API Key format kontrolü
console.log('🔑 API Key kontrol ediliyor...');
console.log('   API Key uzunluğu:', API_KEY.length, 'karakter');
console.log('   API Key başlangıcı:', API_KEY.substring(0, 10) + '...');
if (API_KEY.length < 30) {
    console.warn('⚠️  API Key çok kısa görünüyor.');
}

// 📂 Dosya yolları
const TASK_PATH = path.join(__dirname, '../tasks/active-task.md');
const PROJECT_ROOT = path.join(__dirname, '..');

// 🛠️ Yardımcı: HTTP POST İsteği (v1beta API)
function postToGemini(payload) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/${API_VERSION}/models/${MODEL_NAME}:generateContent?key=${API_KEY}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error("API yanıtı JSON değil: " + data.substring(0, 500)));
                    }
                } else {
                    reject(new Error(`API Hatası (${res.statusCode}): ${data.substring(0, 500)}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(JSON.stringify(payload));
        req.end();
    });
}

// 📖 Dosya Okuma Yardımcısı
function readFileSafe(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8');
        }
    } catch (e) {
        // Hata durumunda null döndür
    }
    return null;
}

// 📁 Proje dosyalarını analiz et
function getProjectContext() {
    const context = {
        files: []
    };

    // package.json
    const pkgJson = readFileSafe(path.join(PROJECT_ROOT, 'package.json'));
    if (pkgJson) {
        context.files.push({ path: 'package.json', content: pkgJson });
    }

    // README.md
    const readme = readFileSafe(path.join(PROJECT_ROOT, 'README.md'));
    if (readme) {
        context.files.push({ path: 'README.md', content: readme });
    }

    // Diğer önemli dosyalar
    const importantFiles = ['server.js', 'index.js', 'app.js'];
    for (const file of importantFiles) {
        const content = readFileSafe(path.join(PROJECT_ROOT, file));
        if (content) {
            context.files.push({ path: file, content: content.substring(0, 5000) });
        }
    }

    return context;
}

// 💾 Git commit yap
function commitChanges() {
    try {
        // Git kullanıcı ayarları
        try {
            execSync('git config user.name "AI Developer Agent"', { cwd: PROJECT_ROOT, stdio: 'ignore' });
            execSync('git config user.email "ai-agent@github.com"', { cwd: PROJECT_ROOT, stdio: 'ignore' });
        } catch (e) {}

        execSync('git add -A', { cwd: PROJECT_ROOT });
        
        const status = execSync('git status --porcelain', { 
            cwd: PROJECT_ROOT,
            encoding: 'utf-8'
        });

        if (status.trim()) {
            execSync('git commit -m "🤖 AI Agent: Otomatik kod değişiklikleri"', { 
                cwd: PROJECT_ROOT,
                stdio: 'ignore'
            });
            console.log('✅ Değişiklikler commit edildi');
            return true;
        } else {
            console.log('ℹ️  Commit edilecek değişiklik yok');
            return false;
        }
    } catch (error) {
        console.error('❌ Git commit hatası (önemli olmayabilir):', error.message);
        return false;
    }
}

// 🚀 ANA AGENT
async function runAgent() {
    console.log(`🚀 AI Developer Agent başlatılıyor (${MODEL_NAME} - ${API_VERSION})...\n`);

    // 1. Görevi Oku
    const taskContent = readFileSafe(TASK_PATH);
    if (!taskContent) {
        console.error("❌ Görev dosyası bulunamadı:", TASK_PATH);
        process.exit(1);
    }
    console.log(`📖 Görev okundu (${taskContent.length} karakter)\n`);

    // 2. Context Topla
    console.log('🔍 Proje analiz ediliyor...');
    const context = getProjectContext();
    console.log(`✅ ${context.files.length} dosya analiz edildi\n`);

    // 3. Prompt Hazırla
    const systemPrompt = `Sen uzman bir Full-Stack Node.js geliştiricisisin. Aşağıdaki görevi yerine getirmek için gerekli kod değişikliklerini yap.

## Talimatlar:
1. Görevi analiz et ve gerekli değişiklikleri belirle
2. Yeni dosyalar oluştur veya mevcut dosyaları güncelle
3. Her dosya için tam içeriği JSON formatında döndür
4. Sadece değişen veya yeni dosyaları döndür
5. Kod kalitesi ve best practice'lere uy
6. Express.js kullanıyorsan server.js oluştur ve package.json scripts kısmını güncelle
7. Kesinlikle geçerli bir JSON döndür (markdown bloğu kullanma)

## Çıktı Formatı (JSON):
{
  "files": [
    {
      "path": "dosya/yolu.js",
      "action": "create|update",
      "content": "dosya içeriği buraya"
    }
  ],
  "summary": "Yapılan değişikliklerin özeti"
}`;

    const userMessage = `## Mevcut Proje Dosyaları:
${context.files.map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')}

## Görev:
${taskContent}`;

    try {
        console.log("🤖 Google AI'ya bağlanılıyor...");
        
        const response = await postToGemini({
            contents: [{
                parts: [
                    { text: systemPrompt },
                    { text: userMessage }
                ]
            }],
            generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json" // JSON modunu zorla
            }
        });

        // 4. Yanıtı İşle
        const candidate = response.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!candidate) {
            throw new Error("AI boş yanıt döndürdü.");
        }

        console.log("📥 Yanıt alındı, işleniyor...");
        let result;
        try {
            // Markdown temizliği (varsa)
            const cleanJson = candidate.replace(/```json/g, '').replace(/```/g, '').trim();
            result = JSON.parse(cleanJson);
        } catch (e) {
            console.error("❌ JSON Parse Hatası. Gelen veri:", candidate.substring(0, 500));
            process.exit(1);
        }

        // 5. Dosyaları Yaz
        if (result.files && Array.isArray(result.files)) {
            console.log(`📝 ${result.files.length} dosya güncelleniyor...\n`);
            result.files.forEach(file => {
                const fullPath = path.join(PROJECT_ROOT, file.path);
                const dir = path.dirname(fullPath);
                
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                fs.writeFileSync(fullPath, file.content);
                console.log(`✅ ${file.action === 'create' ? 'Oluşturuldu' : 'Güncellendi'}: ${file.path}`);
            });

            if (result.summary) {
                console.log('\n📋 Özet:', result.summary);
            }
        } else {
            console.log("⚠️ AI dosya üretmedi. Yanıt:", JSON.stringify(result).substring(0, 200));
        }

        // 6. Git Commit
        commitChanges();

        console.log('\n✨ AI Agent görevi tamamlandı!');

    } catch (error) {
        console.error("❌ Kritik Hata:", error.message);
        if (error.stack) {
            console.error("Stack trace:", error.stack.substring(0, 500));
        }
        process.exit(1);
    }
}

// Çalıştır
runAgent().catch((error) => {
    console.error('❌ Beklenmeyen hata:', error);
    process.exit(1);
});

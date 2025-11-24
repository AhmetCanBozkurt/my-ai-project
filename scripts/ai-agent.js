const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// ⚙️ AYARLAR
const API_KEY = process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
const API_VERSION = "v1beta"; 
const HOST = 'generativelanguage.googleapis.com';

if (!API_KEY) {
    console.error("❌ HATA: API Key bulunamadı! (Secrets ayarlarını kontrol et)");
    process.exit(1);
}

// 📂 Dosya yolları
const TASK_PATH = path.join(__dirname, '../tasks/active-task.md');
const PROJECT_ROOT = path.join(__dirname, '..');

// 🛠️ Yardımcı: HTTP İstekçisi
function makeRequest(method, endpoint, payload = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST,
            path: endpoint,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error("API yanıtı JSON değil"));
                    }
                } else {
                    // Hata detayını yakala
                    resolve({ error: true, status: res.statusCode, message: data });
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (payload) req.write(JSON.stringify(payload));
        req.end();
    });
}

// 🔍 Çalışan Modeli Bulucu (EN ÖNEMLİ KISIM)
async function findWorkingModel() {
    console.log("🔍 Senin hesabın için çalışan model aranıyor...");
    try {
        const result = await makeRequest('GET', `/${API_VERSION}/models?key=${API_KEY}`);
        
        if (result.error) {
            console.error(`⚠️ Model listesi alınamadı (${result.status}). Varsayılan deneniyor.`);
            return "gemini-1.5-flash"; // Fallback
        }

        // Listeden 'generateContent' destekleyenleri filtrele
        const usableModels = result.models.filter(m => 
            m.supportedGenerationMethods && 
            m.supportedGenerationMethods.includes("generateContent")
        );

        // Öncelik sırası: Flash > Pro > Diğerleri
        let selectedModel = usableModels.find(m => m.name.includes("gemini-1.5-flash"));
        if (!selectedModel) selectedModel = usableModels.find(m => m.name.includes("gemini-1.5-pro"));
        if (!selectedModel) selectedModel = usableModels.find(m => m.name.includes("gemini-pro"));
        if (!selectedModel) selectedModel = usableModels[0];

        if (selectedModel) {
            // "models/gemini-xyz" formatında gelir, "models/" kısmını atabiliriz veya API kabul eder.
            // Genelde API tam ismi (models/...) sever.
            let modelName = selectedModel.name.replace("models/", "");
            console.log(`✅ BULUNDU: En uygun model -> ${modelName}`);
            return modelName;
        }

    } catch (e) {
        console.error("⚠️ Model ararken hata:", e.message);
    }
    return "gemini-1.5-flash-latest"; // Son çare
}

// 📖 Dosya Okuma
function readFileSafe(filePath) {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8');
    return null;
}

// 🚀 ANA AGENT
async function runAgent() {
    // 1. Önce Modeli Bul
    const MODEL_NAME = await findWorkingModel();
    console.log(`🚀 AI Agent Başlatılıyor (${MODEL_NAME})...`);

    // 2. Görevi Oku
    const taskContent = readFileSafe(TASK_PATH);
    if (!taskContent) {
        console.log("❌ Görev dosyası bulunamadı:", TASK_PATH);
        process.exit(1);
    }
    
    // Görev içeriğinden branch ismi oluştur (her görev için farklı PR)
    const taskHash = crypto.createHash('md5').update(taskContent).digest('hex').substring(0, 8);
    const BRANCH_NAME = `ai-agent/task-${taskHash}`;
    
    // Branch ismini environment variable olarak kaydet (workflow için)
    process.env.AI_AGENT_BRANCH = BRANCH_NAME;
    console.log(`🌿 PR Branch: ${BRANCH_NAME}`);
    
    // 3. Proje Bağlamı
    const pkgJson = readFileSafe(path.join(PROJECT_ROOT, 'package.json')) || "{}";
    
    // 4. Prompt
    const systemPrompt = `Sen uzman bir Full-Stack Node.js geliştiricisisin. Aşağıdaki görevi yerine getirmek için gerekli kod değişikliklerini yap.

## Talimatlar:
1. Görevi dikkatlice analiz et
2. Gerekli tüm dosyaları oluştur veya güncelle
3. Her dosya için TAM içeriği JSON formatında döndür
4. Sadece JSON döndür, markdown bloğu kullanma
5. Express.js kullanıyorsan server.js oluştur ve package.json'a start script'i ekle
6. Tüm kodlar çalışır durumda olmalı

## Çıktı Formatı (SADECE JSON, markdown yok):
{
  "files": [
    {
      "path": "server.js",
      "content": "const express = require('express');\\nconst app = express();\\n..."
    },
    {
      "path": "package.json",
      "content": "{...}"
    }
  ]
}`;

    const userMessage = `## Mevcut Proje:
${pkgJson}

## Görev:
${taskContent}

Yukarıdaki görevi yerine getir ve gerekli tüm dosyaları oluştur.`;

    try {
        console.log("⏳ Kod yazılıyor...");
        
        const response = await makeRequest('POST', `/${API_VERSION}/models/${MODEL_NAME}:generateContent?key=${API_KEY}`, {
            contents: [{
                parts: [
                    { text: systemPrompt },
                    { text: userMessage }
                ]
            }],
            generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json"
            }
        });

        if (response.error) {
            throw new Error(`API Hatası: ${response.message}`);
        }

        // 5. Yanıtı İşle
        const candidate = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidate) throw new Error("AI boş yanıt döndürdü.");

        console.log("📥 Yanıt işleniyor...");
        console.log("📄 Ham yanıt (ilk 500 karakter):", candidate.substring(0, 500));
        
        let result;
        try {
            // Markdown temizliği
            let cleanJson = candidate.trim();
            // ```json ... ``` formatını temizle
            cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
            // Eğer hala ``` varsa temizle
            cleanJson = cleanJson.replace(/```/g, '').trim();
            
            result = JSON.parse(cleanJson);
            console.log(`✅ JSON parse başarılı. ${result.files ? result.files.length : 0} dosya bulundu.`);
        } catch (e) {
            console.error("❌ JSON Parse Hatası:", e.message);
            console.error("📄 Parse edilemeyen veri:", candidate.substring(0, 1000));
            process.exit(1);
        }

        // 6. Dosyaları Yaz
        if (result.files && Array.isArray(result.files) && result.files.length > 0) {
            console.log(`\n📝 ${result.files.length} dosya yazılıyor...\n`);
            result.files.forEach((file, index) => {
                if (!file.path || !file.content) {
                    console.log(`⚠️ Dosya ${index + 1} geçersiz (path veya content eksik), atlanıyor.`);
                    return;
                }
                
                const fullPath = path.join(PROJECT_ROOT, file.path);
                const dir = path.dirname(fullPath);
                
                try {
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    fs.writeFileSync(fullPath, file.content, 'utf8');
                    console.log(`✅ [${index + 1}/${result.files.length}] Dosya yazıldı: ${file.path}`);
                } catch (writeError) {
                    console.error(`❌ Dosya yazılamadı (${file.path}):`, writeError.message);
                }
            });
            console.log(`\n✨ Toplam ${result.files.length} dosya işlendi.`);
        } else {
            console.log("⚠️ AI dosya üretmedi veya files array boş.");
            console.log("📄 AI yanıtı:", JSON.stringify(result, null, 2).substring(0, 500));
            process.exit(1);
        }

    } catch (error) {
        console.error("💥 Kritik Hata:", error.message);
        process.exit(1);
    }
}

runAgent();
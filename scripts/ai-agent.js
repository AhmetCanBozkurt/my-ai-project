#!/usr/bin/env node

/**
 * Cloud AI Developer Agent
 * Google Gemini API kullanarak kod yazan otomatik ajan
 * DÜZELTİLMİŞ VERSİYON (Model isimleri güncellendi)
 */

const fs = require('fs').promises;
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { execSync } = require('child_process');
const https = require('https');

// Yapılandırma
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TASK_FILE = path.join(__dirname, '..', 'tasks', 'active-task.md');
const PROJECT_ROOT = path.join(__dirname, '..');

if (!GEMINI_API_KEY) {
  console.error('❌ HATA: GEMINI_API_KEY environment variable tanımlı değil!');
  console.error('💡 GitHub Repository > Settings > Secrets and variables > Actions > GEMINI_API_KEY ekleyin');
  process.exit(1);
}

// API Key format kontrolü ve debug
console.log('🔑 API Key kontrol ediliyor...');
console.log('   API Key uzunluğu:', GEMINI_API_KEY.length, 'karakter');
console.log('   API Key başlangıcı:', GEMINI_API_KEY.substring(0, 10) + '...');
if (GEMINI_API_KEY.length < 30) {
  console.warn('⚠️  API Key çok kısa görünüyor. Lütfen doğru API key\'i kullandığınızdan emin olun.');
}
if (GEMINI_API_KEY.includes(' ') || GEMINI_API_KEY.includes('\n')) {
  console.warn('⚠️  API Key\'de boşluk veya yeni satır karakteri var. Bu sorun yaratabilir.');
}

// Gemini AI başlatma
// 🛠️ DÜZELTME: Google AI Studio API key'leri v1 API'sini kullanır
// SDK 0.24.1 hala v1beta kullanıyor, bu yüzden direkt REST API kullanacağız
// Alternatif: SDK'nın API versiyonunu kontrol et ve v1'e zorla
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Model adlarını test et - SDK 'models/' prefix'i olmadan kullanır
// Doğru format: 'gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'
// Yanlış: 'models/gemini-pro' (bu SDK tarafından otomatik eklenir)
let currentModelName = 'gemini-1.5-flash'; // En güncel ve hızlı model
let model = genAI.getGenerativeModel({ model: currentModelName });

// Debug: Model adını logla
console.log('🔧 Model adı:', currentModelName);

/**
 * Task dosyasını oku
 */
async function readTask() {
  try {
    const taskContent = await fs.readFile(TASK_FILE, 'utf-8');
    return taskContent;
  } catch (error) {
    console.error('❌ Task dosyası okunamadı:', error.message);
    process.exit(1);
  }
}

/**
 * Proje dosyalarını analiz et ve context oluştur
 */
async function getProjectContext() {
  const context = {
    files: [],
    structure: []
  };

  try {
    // package.json varsa oku
    try {
      const packageJson = await fs.readFile(
        path.join(PROJECT_ROOT, 'package.json'),
        'utf-8'
      );
      context.files.push({
        path: 'package.json',
        content: packageJson
      });
    } catch (e) {}

    // README varsa oku
    try {
      const readme = await fs.readFile(
        path.join(PROJECT_ROOT, 'README.md'),
        'utf-8'
      );
      context.files.push({
        path: 'README.md',
        content: readme
      });
    } catch (e) {}

    // Proje yapısını tara (max 20 dosya)
    const files = await getAllFiles(PROJECT_ROOT, 20);
    for (const file of files) {
      if (file.endsWith('.md') || file.endsWith('.js') || file.endsWith('.ts') || 
          file.endsWith('.json') || file.endsWith('.yml') || file.endsWith('.yaml')) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const relativePath = path.relative(PROJECT_ROOT, file);
          context.files.push({
            path: relativePath,
            content: content.substring(0, 5000) // Max 5000 karakter
          });
        } catch (e) {}
      }
    }
  } catch (error) {
    console.warn('⚠️  Proje context oluşturulurken hata:', error.message);
  }

  return context;
}

/**
 * Tüm dosyaları recursive olarak bul
 */
async function getAllFiles(dirPath, maxFiles = 50) {
  const files = [];
  const ignoreDirs = ['node_modules', '.git', '.github', 'dist', 'build', '.next'];

  async function scanDir(currentPath) {
    if (files.length >= maxFiles) return;

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (files.length >= maxFiles) break;
        
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(dirPath, fullPath);
        
        if (ignoreDirs.some(ignore => relativePath.includes(ignore))) {
          continue;
        }

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {}
  }

  await scanDir(dirPath);
  return files;
}

/**
 * REST API ile direkt Gemini API çağrısı (v1 API versiyonu için)
 */
async function callGeminiAPIv1(modelName, prompt) {
  return new Promise((resolve, reject) => {
    const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
    
    const postData = JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            if (response.candidates && response.candidates[0] && response.candidates[0].content) {
              const text = response.candidates[0].content.parts[0].text;
              resolve(text);
            } else {
              reject(new Error('Unexpected API response format: ' + JSON.stringify(response).substring(0, 200)));
            }
          } catch (e) {
            reject(new Error('Failed to parse API response: ' + e.message));
          }
        } else {
          reject(new Error(`API returned status ${res.statusCode}: ${data.substring(0, 500)}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Request failed: ${e.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * AI'dan kod değişikliklerini al
 */
async function getAISuggestions(task, context) {
  const prompt = `
Sen bir profesyonel yazılım geliştiricisisin. Aşağıdaki görevi yerine getirmek için gerekli kod değişikliklerini yap.

## Görev:
${task}

## Mevcut Proje Yapısı:
${JSON.stringify(context.files.map(f => f.path), null, 2)}

## Mevcut Dosyalar:
${context.files.map(f => `\n### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``).join('\n')}

## Talimatlar:
1. Görevi analiz et ve gerekli değişiklikleri belirle
2. Yeni dosyalar oluştur veya mevcut dosyaları güncelle
3. Her dosya için tam içeriği JSON formatında döndür
4. Sadece değişen veya yeni dosyaları döndür
5. Kod kalitesi ve best practice'lere uy
6. Express.js kullanıyorsan server.js oluştur ve package.json scripts kısmını güncelle
7. Kesinlikle geçerli bir JSON döndür.

## Çıktı Formatı (JSON):
\`\`\`json
{
  "files": [
    {
      "path": "dosya/yolu.js",
      "action": "create|update",
      "content": "dosya içeriği buraya"
    }
  ],
  "summary": "Yapılan değişikliklerin özeti"
}
\`\`\`
`;

  try {
    console.log('🤖 AI ile iletişim kuruluyor...');
    console.log(`🤖 Kullanılan model: ${currentModelName}`);
    console.log('🔄 v1 API versiyonu ile direkt REST API çağrısı yapılıyor...');
    
    // 🛠️ DÜZELTME: SDK v1beta kullanıyor, Google AI Studio API key'leri v1 gerektiriyor
    // Bu yüzden direkt REST API kullanıyoruz
    const modelNames = [
      'gemini-1.5-flash',  // En hızlı ve güncel
      'gemini-1.5-pro',    // Daha güçlü
      'gemini-pro'         // Eski stabil versiyon
    ];
    
    let text = null;
    let success = false;
    
    for (const modelName of modelNames) {
      try {
        console.log(`🔄 ${modelName} deneniyor (v1 API)...`);
        text = await callGeminiAPIv1(modelName, prompt);
        console.log(`✅ ${modelName} ile başarılı!`);
        currentModelName = modelName;
        success = true;
        break;
      } catch (e) {
        const errorMsg = e.message || String(e);
        console.log(`❌ ${modelName} çalışmadı:`);
        console.log(`   Hata: ${errorMsg.substring(0, 200)}`);
        continue;
      }
    }
    
    if (!success || !text) {
      throw new Error('Hiçbir model çalışmadı. API Key veya kota durumunu kontrol edin.');
    }
    
    console.log('📥 AI yanıtı parse ediliyor...');
    
    // JSON Temizleme ve Parse Etme
    let jsonStr = text;
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || 
                      text.match(/```json([\s\S]*?)```/) || 
                      text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
        jsonStr = jsonMatch[1] || jsonMatch[0];
    }

    try {
        const parsed = JSON.parse(jsonStr);
        return parsed;
    } catch (e) {
        console.error('❌ JSON Parse Hatası. Ham veri:', text.substring(0, 200));
        return null;
    }

  } catch (error) {
    console.error('❌ AI API hatası:', error.message);
    // Detaylı hata bilgisi - URL'yi görmek için
    if (error.message && error.message.includes('fetching from')) {
      const urlMatch = error.message.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        console.error('🔍 Kullanılan URL:', urlMatch[0]);
      }
    }
    if (error.stack) {
      console.error('Stack trace:', error.stack.substring(0, 500));
    }
    return null;
  }
}

/**
 * Dosyaları uygula
 */
async function applyChanges(changes) {
  if (!changes || !changes.files) {
    console.log('⚠️  Uygulanacak değişiklik yok');
    return;
  }

  console.log(`📝 ${changes.files.length} dosya güncelleniyor...`);

  for (const file of changes.files) {
    const filePath = path.join(PROJECT_ROOT, file.path);
    const dirPath = path.dirname(filePath);

    try {
      await fs.mkdir(dirPath, { recursive: true });
      await fs.writeFile(filePath, file.content, 'utf-8');
      console.log(`✅ ${file.action === 'create' ? 'Oluşturuldu' : 'Güncellendi'}: ${file.path}`);
    } catch (error) {
      console.error(`❌ ${file.path} yazılamadı:`, error.message);
    }
  }

  if (changes.summary) {
    console.log('\n📋 Özet:', changes.summary);
  }
}

/**
 * Git commit yap
 */
async function commitChanges() {
  try {
    // Git kullanıcı ayarları (CI ortamında yoksa)
    try {
        execSync('git config user.name "AI Developer Agent"', { cwd: PROJECT_ROOT, stdio: 'ignore' });
        execSync('git config user.email "ai-agent@github.com"', { cwd: PROJECT_ROOT, stdio: 'ignore' });
    } catch (e) {} // Hata verirse (zaten ayarlıysa) devam et

    execSync('git add -A', { cwd: PROJECT_ROOT });
    
    const status = execSync('git status --porcelain', { 
      cwd: PROJECT_ROOT,
      encoding: 'utf-8'
    });

    if (status.trim()) {
      execSync('git commit -m "🤖 AI Agent: Otomatik kod değişiklikleri"', { 
        cwd: PROJECT_ROOT 
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

/**
 * Ana fonksiyon
 */
async function main() {
  try {
    console.log('🚀 AI Developer Agent başlatılıyor...\n');
    
    // Task oku
    console.log('📖 Task dosyası okunuyor:', TASK_FILE);
    const task = await readTask();

    // Context oluştur
    console.log('🔍 Proje analiz ediliyor...');
    const context = await getProjectContext();

    // AI İşlemi
    const changes = await getAISuggestions(task, context);
    
    if (!changes) {
      console.error('❌ İşlem başarısız oldu.');
      process.exit(1);
    }

    // Değişiklikleri uygula
    await applyChanges(changes);

    // Commit
    await commitChanges();
    
    console.log('\n✨ AI Agent görevi tamamlandı!');

  } catch (error) {
    console.error('\n❌ Kritik hata:', error.message);
    process.exit(1);
  }
}

main();
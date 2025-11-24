#!/usr/bin/env node

/**
 * Cloud AI Developer Agent
 * Google Gemini API kullanarak kod yazan otomatik ajan
 */

const fs = require('fs').promises;
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { execSync } = require('child_process');

// Yapılandırma
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TASK_FILE = path.join(__dirname, '..', 'tasks', 'active-task.md');
const PROJECT_ROOT = path.join(__dirname, '..');

if (!GEMINI_API_KEY) {
  console.error('❌ HATA: GEMINI_API_KEY environment variable tanımlı değil!');
  process.exit(1);
}

// Gemini AI başlatma
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
    } catch (e) {
      // package.json yoksa devam et
    }

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
    } catch (e) {
      // README yoksa devam et
    }

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
        } catch (e) {
          // Dosya okunamazsa atla
        }
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
        
        // Ignore dizinleri atla
        if (ignoreDirs.some(ignore => relativePath.includes(ignore))) {
          continue;
        }

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Hata durumunda devam et
    }
  }

  await scanDir(dirPath);
  return files;
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
6. HTML/React kodlarında label elementlerini doğru kullan (for attribute'u geçerli bir id'ye referans vermeli)
7. Tüm kodlar çalışır durumda ve syntax hatası içermemeli
8. Eğer Express.js kullanıyorsan, server.js dosyası oluştur ve package.json'a start script'i ekle

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
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('📥 AI yanıtı alındı, parse ediliyor...');
    console.log('📏 Yanıt uzunluğu:', text.length, 'karakter');
    
    // JSON çıktısını parse et - farklı formatları dene
    let jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      // Alternatif format: ```json ... ```
      jsonMatch = text.match(/```json([\s\S]*?)```/);
    }
    if (!jsonMatch) {
      // Alternatif format: { ... } direkt
      jsonMatch = text.match(/\{[\s\S]*\}/);
    }
    
    if (jsonMatch) {
      try {
        const jsonText = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonText);
        console.log('✅ JSON başarıyla parse edildi');
        return parsed;
      } catch (e) {
        console.error('⚠️  JSON match bulundu ama parse edilemedi:', e.message);
      }
    }

    // JSON bulunamazsa, tüm metni parse etmeyi dene
    try {
      const parsed = JSON.parse(text);
      console.log('✅ Tüm metin JSON olarak parse edildi');
      return parsed;
    } catch (e) {
      console.error('❌ AI yanıtı parse edilemedi');
      console.error('Parse hatası:', e.message);
      console.log('\n📄 AI Yanıtı (ilk 3000 karakter):');
      console.log(text.substring(0, 3000));
      if (text.length > 3000) {
        console.log(`... (${text.length - 3000} karakter daha var)`);
      }
      return null;
    }
  } catch (error) {
    console.error('❌ AI API hatası:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    if (error.response) {
      console.error('API Response:', error.response);
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
      // Dizin yoksa oluştur
      await fs.mkdir(dirPath, { recursive: true });

      // Dosyayı yaz
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
    execSync('git config user.name "AI Developer Agent"', { cwd: PROJECT_ROOT });
    execSync('git config user.email "ai-agent@github.com"', { cwd: PROJECT_ROOT });
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
    console.error('❌ Git commit hatası:', error.message);
    return false;
  }
}

/**
 * Ana fonksiyon
 */
async function main() {
  console.log('🚀 AI Developer Agent başlatılıyor...\n');

  // Task oku
  console.log('📖 Task dosyası okunuyor...');
  const task = await readTask();
  console.log('✅ Task okundu\n');

  // Context oluştur
  console.log('🔍 Proje analiz ediliyor...');
  const context = await getProjectContext();
  console.log(`✅ ${context.files.length} dosya analiz edildi\n`);

  // AI'dan önerileri al
  console.log('🤖 AI\'dan kod önerileri isteniyor...');
  const changes = await getAISuggestions(task, context);
  
  if (!changes) {
    console.error('❌ AI yanıtı alınamadı veya parse edilemedi');
    console.error('💡 Lütfen AI yanıtını kontrol edin ve tekrar deneyin');
    process.exit(1);
  }

  if (!changes.files || changes.files.length === 0) {
    console.log('ℹ️  AI herhangi bir dosya değişikliği önermedi');
    console.log('💡 Göreviniz zaten tamamlanmış olabilir veya daha spesifik talimatlar gerekebilir');
    process.exit(0);
  }

  // Değişiklikleri uygula
  await applyChanges(changes);

  // Git commit
  const committed = await commitChanges();
  
  if (committed) {
    console.log('\n✨ AI Agent görevi tamamlandı! Değişiklikler commit edildi.');
  } else {
    console.log('\n✨ AI Agent görevi tamamlandı! (Değişiklik yoktu veya commit edilemedi)');
  }
}

// Hata yakalama
process.on('unhandledRejection', (error) => {
  console.error('❌ Beklenmeyen hata:', error);
  process.exit(1);
});

// Çalıştır
main().catch((error) => {
  console.error('❌ Kritik hata:', error);
  if (error.stack) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
});


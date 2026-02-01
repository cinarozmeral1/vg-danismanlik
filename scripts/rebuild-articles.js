require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const COUNTRIES = [
    { en: 'Czech Republic', tr: 'Çek Cumhuriyeti' },
    { en: 'Italy', tr: 'İtalya' },
    { en: 'UK', tr: 'İngiltere' }
];

async function generateContent(prompt, lang) {
    const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Authorization': 'Bearer ' + process.env.GROQ_API_KEY 
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { 
                    role: 'system', 
                    content: lang === 'tr' 
                        ? 'Blog yazarısın. SADECE <h2>, <h3>, <p>, <ul>, <li> tagleri kullan. <html>, <head>, <body>, <title> KULLANMA. Düz içerik yaz.'
                        : 'You are a blog writer. Use ONLY <h2>, <h3>, <p>, <ul>, <li> tags. DO NOT use <html>, <head>, <body>, <title>. Write plain content only.'
                },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000
        })
    });
    const data = await res.json();
    let content = data.choices?.[0]?.message?.content || '';
    
    // Temizle - html/head/body tagleri varsa kaldır
    content = content
        .replace(/<html[^>]*>[\s\S]*?<body[^>]*>/gi, '')
        .replace(/<\/body>[\s\S]*?<\/html>/gi, '')
        .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
        .replace(/<\/?html[^>]*>/gi, '')
        .replace(/<\/?body[^>]*>/gi, '')
        .replace(/<\/?head[^>]*>/gi, '')
        .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
        .replace(/```html/gi, '')
        .replace(/```/g, '')
        .trim();
    
    return content;
}

async function createArticle(countryData, index) {
    console.log('📝 Makale ' + (index+1) + ' - ' + countryData.tr + '...');
    
    const dept = await pool.query(`
        SELECT d.id, d.name_tr, d.name_en, d.price, d.currency,
               u.id as uid, u.name as uni, u.city
        FROM university_departments d
        JOIN universities u ON d.university_id = u.id
        WHERE u.country = $1 AND d.is_active = true AND d.name_tr NOT LIKE '%Hazırlık%'
        ORDER BY RANDOM() LIMIT 1
    `, [countryData.en]);
    
    if (!dept.rows.length) { 
        console.log('   ❌ Bölüm yok'); 
        return; 
    }
    
    const d = dept.rows[0];
    console.log('   📌 ' + d.uni + ' - ' + d.name_tr);
    
    // TR içerik
    const trPrompt = `${d.uni} üniversitesinin ${d.name_tr} bölümü hakkında blog makalesi yaz. Şehir: ${d.city}, Ülke: ${countryData.tr}. 400-500 kelime. Venture Global danışmanlık şirketini 2-3 kez doğal şekilde an.`;
    console.log('   🇹🇷 Türkçe yazılıyor...');
    const contentTR = await generateContent(trPrompt, 'tr');
    
    // EN içerik
    const enName = d.name_en || d.name_tr;
    const enPrompt = `Write a blog article about the ${enName} program at ${d.uni}. City: ${d.city}, Country: ${countryData.en}. 400-500 words. Naturally mention Venture Global consultancy company 2-3 times.`;
    console.log('   🇬🇧 İngilizce yazılıyor...');
    const contentEN = await generateContent(enPrompt, 'en');
    
    const titleTR = `${d.uni} - ${d.name_tr} Bölümü`;
    const titleEN = `${d.uni} - ${enName} Program`;
    
    const slug = titleTR.toLowerCase()
        .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
        .replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').substring(0,50) + '-' + Date.now().toString(36);
    
    const excerptTR = contentTR.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 180) + '...';
    const excerptEN = contentEN.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 180) + '...';
    
    await pool.query(`
        INSERT INTO blog_posts (
            title_tr, title_en, slug, content_tr, content_en,
            excerpt_tr, excerpt_en, meta_description_tr, meta_description_en,
            keywords, topic_type, related_university_id, related_country,
            featured_image_url, is_published, published_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NULL, true, NOW())
    `, [
        titleTR, titleEN, slug, contentTR, contentEN, excerptTR, excerptEN,
        (d.uni + ' ' + d.name_tr).substring(0, 155),
        (d.uni + ' ' + enName).substring(0, 155),
        'Venture Global, ' + d.uni + ', ' + countryData.tr,
        'department', d.uid, countryData.en
    ]);
    
    console.log('   ✅ Kaydedildi!');
    console.log('');
}

async function main() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌍 3 ÇİFT DİLLİ MAKALE OLUŞTURULUYOR');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    for (let i = 0; i < 3; i++) {
        await createArticle(COUNTRIES[i], i);
    }
    
    // Kontrol
    const posts = await pool.query('SELECT id, title_tr, title_en, LEFT(content_tr, 60) as tr, LEFT(content_en, 60) as en FROM blog_posts');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SONUÇ:');
    for (const p of posts.rows) {
        const isRealTR = p.tr && !p.tr.includes('<html') && !p.tr.includes('<head');
        const isRealEN = p.en && !p.en.includes('<html') && !p.en.includes('<head');
        console.log('   🇹🇷 ' + (isRealTR ? '✅' : '❌') + ' 🇬🇧 ' + (isRealEN ? '✅' : '❌') + ' ' + p.title_tr.substring(0, 35));
    }
    
    process.exit(0);
}

main();





















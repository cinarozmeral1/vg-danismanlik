// AI Blog Service - Bilingual articles from REAL university/department data
// Çeşitlilik için tüm ülkeler rotasyonlu şekilde kullanılıyor
// SADECE LİSANS BÖLÜMLERİ - Yükseklisans bölümleri hariç tutuldu
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Tüm ülkeler - çeşitlilik için rotasyonlu sistem
// Her blog yazısında farklı ülkeden seçim yapılacak
const ALL_COUNTRIES = [
    'Czech Republic',
    'Italy', 
    'UK',
    'Germany',
    'Austria',
    'Hungary',
    'Poland',
    'Netherlands'  // Yeni eklendi!
];

const COUNTRY_NAMES = {
    'Czech Republic': { tr: 'Çek Cumhuriyeti', en: 'Czech Republic' },
    'Italy': { tr: 'İtalya', en: 'Italy' },
    'UK': { tr: 'İngiltere', en: 'United Kingdom' },
    'Germany': { tr: 'Almanya', en: 'Germany' },
    'Austria': { tr: 'Avusturya', en: 'Austria' },
    'Hungary': { tr: 'Macaristan', en: 'Hungary' },
    'Poland': { tr: 'Polonya', en: 'Poland' },
    'Netherlands': { tr: 'Hollanda', en: 'Netherlands' }
};


/**
 * Select a real department from database with BALANCED country rotation
 * Her ülkeden eşit sayıda yazı çıkmasını sağlar
 */
async function selectRealDepartment() {
    console.log('🌍 Selecting department with balanced country rotation...');
    
    // 1. Her ülkeden kaç blog yazısı var kontrol et
    const countryStats = await pool.query(`
        SELECT related_country, COUNT(*) as post_count
        FROM blog_posts
        WHERE is_published = true AND related_country IS NOT NULL
        GROUP BY related_country
    `);
    
    const countryCounts = {};
    for (const row of countryStats.rows) {
        countryCounts[row.related_country] = parseInt(row.post_count);
    }
    
    // 2. En az yazısı olan ülkeleri önceliklendir
    const sortedCountries = [...ALL_COUNTRIES].sort((a, b) => {
        const countA = countryCounts[a] || 0;
        const countB = countryCounts[b] || 0;
        return countA - countB; // En az olan önce
    });
    
    console.log('📊 Country post counts:', countryCounts);
    console.log('🎯 Priority order:', sortedCountries.map(c => `${c}(${countryCounts[c] || 0})`).join(', '));
    
    // 3. Öncelikli ülkelerden sırayla dene (SADECE LİSANS BÖLÜMLERİ)
    for (const country of sortedCountries) {
        const result = await pool.query(`
            SELECT d.id, d.name_tr, d.name_en, d.price, d.currency,
                   u.id as university_id, u.name as university_name, u.country, u.city
            FROM university_departments d
            JOIN universities u ON d.university_id = u.id
            WHERE u.country = $1 
            AND d.is_active = true 
            AND u.is_active = true
            AND d.name_tr NOT LIKE '%Hazırlık%'
            AND d.name_tr NOT LIKE '%Yüksek Lisans%'
            AND d.name_tr NOT LIKE '%Yükseklisans%'
            AND d.name_tr NOT LIKE '%Master%'
            AND d.name_tr NOT LIKE '%MSc%'
            AND d.name_tr NOT LIKE '%MBA%'
            AND d.name_tr NOT LIKE '%Doktora%'
            AND d.name_tr NOT LIKE '%PhD%'
            AND d.name_en NOT LIKE '%Master%'
            AND d.name_en NOT LIKE '%MSc%'
            AND d.name_en NOT LIKE '%MBA%'
            AND d.name_en NOT LIKE '%PhD%'
            AND d.name_en NOT LIKE '%Doctorate%'
            AND d.id NOT IN (
                SELECT CAST(NULLIF(SPLIT_PART(topic_key, '_', 2), '') AS INTEGER) 
                FROM blog_topic_history 
                WHERE topic_key LIKE 'dept_%' AND topic_key ~ '^dept_[0-9]+$'
            )
            ORDER BY RANDOM()
            LIMIT 1
        `, [country]);
        
        if (result.rows.length > 0) {
            console.log(`✅ Selected from ${country}: ${result.rows[0].university_name} - ${result.rows[0].name_tr}`);
            return result.rows[0];
        } else {
            console.log(`⚠️ No available departments in ${country}, trying next...`);
        }
    }
    
    // 4. Fallback: Herhangi bir ülkeden random seç (SADECE LİSANS)
    console.log('🔄 Fallback: Selecting from any country (Bachelor only)...');
    const result = await pool.query(`
        SELECT d.id, d.name_tr, d.name_en, d.price, d.currency,
               u.id as university_id, u.name as university_name, u.country, u.city
        FROM university_departments d
        JOIN universities u ON d.university_id = u.id
        WHERE d.is_active = true 
        AND u.is_active = true
        AND d.name_tr NOT LIKE '%Hazırlık%'
        AND d.name_tr NOT LIKE '%Yüksek Lisans%'
        AND d.name_tr NOT LIKE '%Yükseklisans%'
        AND d.name_tr NOT LIKE '%Master%'
        AND d.name_tr NOT LIKE '%MSc%'
        AND d.name_tr NOT LIKE '%MBA%'
        AND d.name_tr NOT LIKE '%Doktora%'
        AND d.name_tr NOT LIKE '%PhD%'
        AND d.name_en NOT LIKE '%Master%'
        AND d.name_en NOT LIKE '%MSc%'
        AND d.name_en NOT LIKE '%MBA%'
        AND d.name_en NOT LIKE '%PhD%'
        AND d.name_en NOT LIKE '%Doctorate%'
        ORDER BY RANDOM()
        LIMIT 1
    `);
    
    return result.rows[0] || null;
}

/**
 * Generate BILINGUAL blog post
 */
async function generateBlogPost() {
    console.log('📝 Starting bilingual blog post generation...');
    
    const dept = await selectRealDepartment();
    
    if (!dept) {
        throw new Error('No available department found');
    }
    
    console.log('📌 Selected:', dept.university_name, '-', dept.name_tr);
    
    const imageUrl = null; // No images, using gradient headers
    const countryTR = COUNTRY_NAMES[dept.country]?.tr || dept.country;
    const countryEN = COUNTRY_NAMES[dept.country]?.en || dept.country;
    
    // Generate BOTH Turkish and English content
    console.log('🤖 Generating Turkish content...');
    const contentTR = await generateContent(dept, 'tr', countryTR);
    
    console.log('🤖 Generating English content...');
    const contentEN = await generateContent(dept, 'en', countryEN);
    
    // Create slugs and excerpts
    const slug = createSlug(dept.university_name + ' ' + dept.name_tr);
    const excerptTR = contentTR.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 180) + '...';
    const excerptEN = contentEN.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 180) + '...';
    
    const titleTR = `${dept.university_name} - ${dept.name_tr} Lisans Programı`;
    const titleEN = `${dept.university_name} - ${dept.name_en || dept.name_tr} Bachelor's Program`;
    
    // Save to database
    const result = await pool.query(`
        INSERT INTO blog_posts (
            title_tr, title_en, slug, content_tr, content_en,
            excerpt_tr, excerpt_en, meta_description_tr, meta_description_en,
            keywords, topic_type, related_university_id, related_country,
            featured_image_url, is_published, published_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, NOW())
        RETURNING *
    `, [
        titleTR,
        titleEN,
        slug,
        contentTR,
        contentEN,
        excerptTR,
        excerptEN,
        `${dept.university_name} ${dept.name_tr} - ${countryTR}`.substring(0, 155),
        `${dept.university_name} ${dept.name_en || dept.name_tr} - ${countryEN}`.substring(0, 155),
        `Venture Global, ${dept.university_name}, ${countryTR}, yurtdışı eğitim`,
        'department',
        dept.university_id,
        dept.country,
        imageUrl
    ]);
    
    // Mark as covered
    await pool.query(`
        INSERT INTO blog_topic_history (topic_key, last_covered_at, times_covered)
        VALUES ($1, NOW(), 1)
        ON CONFLICT (topic_key) DO UPDATE SET last_covered_at = NOW()
    `, [`dept_${dept.id}`]);
    
    console.log('✅ Bilingual blog post saved:', result.rows[0].slug);
    
    return result.rows[0];
}

/**
 * Generate content in specified language
 */
async function generateContent(dept, lang, countryName) {
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
        throw new Error('GROQ_API_KEY is not configured');
    }
    
    const deptName = lang === 'en' ? (dept.name_en || dept.name_tr) : dept.name_tr;
    
    const prompt = lang === 'tr' 
        ? `${dept.university_name} üniversitesinin ${dept.name_tr} LİSANS programı hakkında Türkçe blog makalesi yaz.

BİLGİLER:
- Üniversite: ${dept.university_name}
- Lisans Programı: ${dept.name_tr}
- Şehir: ${dept.city}
- Ülke: ${countryName}
${dept.price ? `- Yıllık Ücret: ${dept.price} ${dept.currency || 'EUR'}` : ''}

KURALLAR:
1. 500-700 kelime
2. Bu LİSANS programının ne öğrettiğini ve kariyer fırsatlarını anlat
3. ${countryName}'de lisans eğitimi almanın avantajlarını anlat
4. "Venture Global" ismini 2-3 kez doğal şekilde kullan
5. Son paragrafta "Venture Global ile iletişime geçebilirsiniz" de
6. Bu bir UNDERGRADUATE / LİSANS programıdır, yüksek lisans değil

FORMAT: Sadece HTML tagleri kullan. Başlıklar için <h2> ve <h3>, paragraflar için <p>, listeler için <ul><li> kullan. Markdown (## veya **) KULLANMA. Kod bloğu EKLEME.`
        : `Write a blog article in English about the ${deptName} BACHELOR'S / UNDERGRADUATE program at ${dept.university_name}.

INFORMATION:
- University: ${dept.university_name}
- Bachelor's Program: ${deptName}
- City: ${dept.city}
- Country: ${countryName}
${dept.price ? `- Annual Fee: ${dept.price} ${dept.currency || 'EUR'}` : ''}

RULES:
1. 500-700 words
2. Explain what this UNDERGRADUATE program teaches and career opportunities
3. Mention advantages of pursuing a bachelor's degree in ${countryName}
4. Naturally mention "Venture Global" 2-3 times
5. End with "Contact Venture Global for more information"
6. This is a BACHELOR'S / UNDERGRADUATE program, NOT a master's degree

FORMAT: Use only HTML tags. Use <h2> and <h3> for headings, <p> for paragraphs, <ul><li> for lists. DO NOT use Markdown (## or **). NO code blocks.`;

    console.log('🌐 Calling Groq API...');
    console.log('🔑 API Key present:', !!apiKey);
    console.log('📝 Language:', lang);
    
    let response;
    try {
        response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { 
                        role: 'system', 
                        content: lang === 'tr' 
                            ? 'Sen Venture Global Eğitim Danışmanlığı için blog yazarısın. SADECE h2, h3, p, ul, li tagleri kullan. html, head, body, title tagleri KULLANMA. Düz içerik yaz.'
                            : 'You are a blog writer for Venture Global Education Consultancy. Use ONLY h2, h3, p, ul, li tags. DO NOT use html, head, body, title tags. Write plain content only.'
                    },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 2500
            })
        });
    } catch (fetchErr) {
        console.error('❌ Fetch error:', fetchErr.message);
        throw new Error(`Network error calling Groq API: ${fetchErr.message}`);
    }
    
    console.log('📡 Groq API response status:', response.status);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Groq API error response:', errorText);
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('✅ Groq API response received');
    let content = data.choices?.[0]?.message?.content || '';
    
    // Clean content - remove html/head/body tags and convert markdown to HTML
    content = content
        .replace(/```html\s*/gi, '')
        .replace(/```/g, '')
        .replace(/<html[^>]*>[\s\S]*?<body[^>]*>/gi, '')
        .replace(/<\/body>[\s\S]*?<\/html>/gi, '')
        .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
        .replace(/<\/?html[^>]*>/gi, '')
        .replace(/<\/?body[^>]*>/gi, '')
        .replace(/<\/?head[^>]*>/gi, '')
        .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
        .replace(/^\s*\{[\s\S]*?\}\s*$/gm, '')
        // Convert markdown to HTML if AI still uses it
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h2>$1</h2>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .trim();
    
    return content;
}

/**
 * Create URL-friendly slug
 */
function createSlug(text) {
    const chars = {'ğ':'g','Ğ':'G','ü':'u','Ü':'U','ş':'s','Ş':'S','ı':'i','İ':'I','ö':'o','Ö':'O','ç':'c','Ç':'C'};
    let slug = text.toLowerCase();
    for (const [tr, en] of Object.entries(chars)) {
        slug = slug.replace(new RegExp(tr, 'g'), en);
    }
    return slug.replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 55) + '-' + Date.now().toString(36);
}

// Export functions
async function getBlogPosts(limit = 20, offset = 0) {
    const result = await pool.query(`
        SELECT id, title_tr, title_en, slug, excerpt_tr, excerpt_en,
               featured_image_url, topic_type, related_country,
               published_at, view_count
        FROM blog_posts WHERE is_published = true
        ORDER BY published_at DESC LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return result.rows;
}

async function getBlogPostBySlug(slug) {
    const result = await pool.query(`SELECT * FROM blog_posts WHERE slug = $1 AND is_published = true`, [slug]);
    if (result.rows.length > 0) {
        await pool.query(`UPDATE blog_posts SET view_count = view_count + 1 WHERE slug = $1`, [slug]);
    }
    return result.rows[0] || null;
}

async function getBlogPostCount() {
    const result = await pool.query(`SELECT COUNT(*) FROM blog_posts WHERE is_published = true`);
    return parseInt(result.rows[0].count);
}

async function getRelatedPosts(post, limit = 3) {
    const result = await pool.query(`
        SELECT id, title_tr, title_en, slug, excerpt_tr, excerpt_en, featured_image_url
        FROM blog_posts WHERE is_published = true AND id != $1
        ORDER BY CASE WHEN related_country = $2 THEN 0 ELSE 1 END, published_at DESC
        LIMIT $3
    `, [post.id, post.related_country, limit]);
    return result.rows;
}

module.exports = { generateBlogPost, getBlogPosts, getBlogPostBySlug, getBlogPostCount, getRelatedPosts };

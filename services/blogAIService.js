// AI Blog Service - Bilingual articles from REAL university/department data
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Priority countries
const PRIORITY_COUNTRIES = ['Czech Republic', 'Italy', 'UK'];

// Verified working images from Unsplash
const IMAGE_BANK = [
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80', // graduation
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&q=80', // students
    'https://images.unsplash.com/photo-1562774053-701939374585?w=800&q=80', // campus
    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&q=80', // lecture
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80', // studying
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80', // group study
    'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800&q=80', // university
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&q=80', // writing
    'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800&q=80', // campus view
    'https://images.unsplash.com/photo-1606761568499-6d2451b23c66?w=800&q=80', // library
    'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&q=80', // classroom
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=80', // books
    'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80', // hallway
    'https://images.unsplash.com/photo-1571260899304-425eee4c7efc?w=800&q=80', // student life
    'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=800&q=80'  // notes
];

const COUNTRY_NAMES = {
    'Czech Republic': { tr: 'Çek Cumhuriyeti', en: 'Czech Republic' },
    'Italy': { tr: 'İtalya', en: 'Italy' },
    'UK': { tr: 'İngiltere', en: 'United Kingdom' },
    'Germany': { tr: 'Almanya', en: 'Germany' },
    'Austria': { tr: 'Avusturya', en: 'Austria' },
    'Hungary': { tr: 'Macaristan', en: 'Hungary' },
    'Poland': { tr: 'Polonya', en: 'Poland' }
};

/**
 * Get a unique image that hasn't been used
 */
async function getUniqueImage() {
    const usedResult = await pool.query('SELECT featured_image_url FROM blog_posts');
    const usedImages = usedResult.rows.map(r => r.featured_image_url);
    
    for (const img of IMAGE_BANK) {
        if (!usedImages.includes(img)) {
            return img;
        }
    }
    
    // If all used, cycle back
    const count = await pool.query('SELECT COUNT(*) FROM blog_posts');
    const index = parseInt(count.rows[0].count) % IMAGE_BANK.length;
    return IMAGE_BANK[index];
}

/**
 * Select a real department from database
 */
async function selectRealDepartment() {
    for (const country of PRIORITY_COUNTRIES) {
        const result = await pool.query(`
            SELECT d.id, d.name_tr, d.name_en, d.price, d.currency,
                   u.id as university_id, u.name as university_name, u.country, u.city
            FROM university_departments d
            JOIN universities u ON d.university_id = u.id
            WHERE u.country = $1 
            AND d.is_active = true 
            AND u.is_active = true
            AND d.name_tr NOT LIKE '%Hazırlık%'
            AND d.id NOT IN (
                SELECT CAST(NULLIF(SPLIT_PART(topic_key, '_', 2), '') AS INTEGER) 
                FROM blog_topic_history 
                WHERE topic_key LIKE 'dept_%' AND topic_key ~ '^dept_[0-9]+$'
            )
            ORDER BY RANDOM()
            LIMIT 1
        `, [country]);
        
        if (result.rows.length > 0) {
            return result.rows[0];
        }
    }
    
    // Fallback to any country
    const result = await pool.query(`
        SELECT d.id, d.name_tr, d.name_en, d.price, d.currency,
               u.id as university_id, u.name as university_name, u.country, u.city
        FROM university_departments d
        JOIN universities u ON d.university_id = u.id
        WHERE d.is_active = true 
        AND u.is_active = true
        AND d.name_tr NOT LIKE '%Hazırlık%'
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
    
    const imageUrl = await getUniqueImage();
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
    
    const titleTR = `${dept.university_name} - ${dept.name_tr} Bölümü`;
    const titleEN = `${dept.university_name} - ${dept.name_en || dept.name_tr} Department`;
    
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
        ? `${dept.university_name} üniversitesinin ${dept.name_tr} bölümü hakkında Türkçe blog makalesi yaz.

BİLGİLER:
- Üniversite: ${dept.university_name}
- Bölüm: ${dept.name_tr}
- Şehir: ${dept.city}
- Ülke: ${countryName}
${dept.price ? `- Yıllık Ücret: ${dept.price} ${dept.currency || 'EUR'}` : ''}

KURALLAR:
1. 500-700 kelime
2. Bu bölümün ne öğrettiğini ve kariyer fırsatlarını anlat
3. ${countryName}'de öğrenci olmanın avantajlarını anlat
4. "Venture Global" ismini 2-3 kez doğal şekilde kullan
5. Son paragrafta "Venture Global ile iletişime geçebilirsiniz" de

FORMAT: Sadece HTML (h2, h3, p, ul, li). JSON veya kod bloğu EKLEME.`
        : `Write a blog article in English about the ${deptName} program at ${dept.university_name}.

INFORMATION:
- University: ${dept.university_name}
- Program: ${deptName}
- City: ${dept.city}
- Country: ${countryName}
${dept.price ? `- Annual Fee: ${dept.price} ${dept.currency || 'EUR'}` : ''}

RULES:
1. 500-700 words
2. Explain what this program teaches and career opportunities
3. Mention advantages of studying in ${countryName}
4. Naturally mention "Venture Global" 2-3 times
5. End with "Contact Venture Global for more information"

FORMAT: Only HTML (h2, h3, p, ul, li). NO JSON or code blocks.`;

    const response = await fetch(GROQ_API_URL, {
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
                        ? 'Sen Venture Global Eğitim Danışmanlığı için blog yazarısın. Sadece düz HTML yaz.'
                        : 'You are a blog writer for Venture Global Education Consultancy. Write only plain HTML.'
                },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2500
        })
    });
    
    if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
    }
    
    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    
    // Clean content
    content = content
        .replace(/```html\s*/gi, '')
        .replace(/```/g, '')
        .replace(/^\s*\{[\s\S]*?\}\s*$/gm, '')
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

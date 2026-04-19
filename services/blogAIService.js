// AI Blog Service - Bilingual articles from REAL university/department data
// Çeşitlilik için tüm ülkeler rotasyonlu şekilde kullanılıyor
// SADECE LİSANS BÖLÜMLERİ - Yükseklisans bölümleri hariç tutuldu
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/search';

/**
 * YouTube Data API v3 ile universite/bolum icin video bul.
 * 3 katmanli arama: (1) universite+bolum, (2) sadece universite, (3) ulke+egitim
 */
async function findYouTubeVideo(universityName, departmentName, countryTR) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
        console.log('⚠️ YOUTUBE_API_KEY not configured, skipping video search');
        return null;
    }

    const searches = [
        `${universityName} ${departmentName}`,
        universityName,
        `${countryTR} üniversite eğitim`
    ];

    for (const query of searches) {
        try {
            const params = new URLSearchParams({
                part: 'snippet',
                q: query,
                type: 'video',
                maxResults: '1',
                relevanceLanguage: 'tr',
                videoEmbeddable: 'true',
                key: apiKey
            });
            const res = await fetch(`${YOUTUBE_API_URL}?${params}`);
            if (!res.ok) continue;
            const data = await res.json();
            if (data.items && data.items.length > 0) {
                const item = data.items[0];
                console.log(`🎬 YouTube video found for "${query}": ${item.snippet.title}`);
                return {
                    videoId: item.id.videoId,
                    title: item.snippet.title,
                    query
                };
            }
        } catch (err) {
            console.log(`⚠️ YouTube search failed for "${query}":`, err.message);
        }
    }
    console.log('⚠️ No YouTube video found for any search query');
    return null;
}

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

// Türkçe URL slug'ları (öğrenci yaşamı sayfaları)
const COUNTRY_STUDENT_LIFE_SLUGS = {
    'Czech Republic': 'cekya',
    'Italy': 'italya',
    'UK': 'ingiltere',
    'Germany': 'almanya',
    'Austria': 'avusturya',
    'Hungary': 'macaristan',
    'Poland': 'polonya',
    'Netherlands': 'hollanda'
};
const OGRENCI_YASAMI_BASE = '/ogrenci-yasami';

/** CJK ve istenmeyen karakterleri kaldır (Çince/Japonca/Korece vb. - sadece Türkçe/İngilizce kalsın) */
function stripUnwantedCharacters(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u3100-\u312f\u31a0-\u31bf\uff00-\uffef]/g, '');
}

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
                   u.id as university_id, u.name as university_name, u.country, u.city, u.slug as university_slug
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
               u.id as university_id, u.name as university_name, u.country, u.city, u.slug as university_slug
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
 * @param {Object} options - { draft: boolean } if draft=true, saves as unpublished
 */
async function generateBlogPost(options = {}) {
    const isDraft = options.draft === true;
    console.log(`📝 Starting bilingual blog post generation... (draft: ${isDraft})`);
    
    const dept = await selectRealDepartment();
    
    if (!dept) {
        throw new Error('No available department found');
    }
    
    console.log('📌 Selected:', dept.university_name, '-', dept.name_tr);
    
    const imageUrl = null;
    const countryTR = COUNTRY_NAMES[dept.country]?.tr || dept.country;
    const countryEN = COUNTRY_NAMES[dept.country]?.en || dept.country;

    console.log('🎬 Searching for YouTube video...');
    const ytVideo = await findYouTubeVideo(dept.university_name, dept.name_tr, countryTR);
    
    console.log('🤖 Generating Turkish content...');
    const contentTR = await generateContent(dept, 'tr', countryTR, ytVideo);
    
    console.log('🤖 Generating English content...');
    const contentEN = await generateContent(dept, 'en', countryEN, ytVideo);
    
    // Excerpts ve SEO uyumlu Türkçe slug (her makaleye özel URL)
    const excerptTR = contentTR.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 180) + '...';
    const excerptEN = contentEN.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 180) + '...';
    
    const titleTR = `${dept.university_name} - ${countryTR}'da ${dept.name_tr} Okumak | ${dept.city}`;
    const titleEN = `${dept.university_name} - Studying ${dept.name_en || dept.name_tr} in ${countryEN} | ${dept.city}`;

    const baseSlug = createSlug(`${dept.city}-${dept.university_name}-${dept.name_tr}`);
    const slug = await ensureUniqueSlug(baseSlug);
    const isPublished = !isDraft;
    
    // Save to database
    const result = await pool.query(`
        INSERT INTO blog_posts (
            title_tr, title_en, slug, content_tr, content_en,
            excerpt_tr, excerpt_en, meta_description_tr, meta_description_en,
            keywords, topic_type, related_university_id, related_country,
            featured_image_url, is_published, published_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, ${isPublished ? 'NOW()' : 'NULL'})
        RETURNING *
    `, [
        titleTR,
        titleEN,
        slug,
        contentTR,
        contentEN,
        excerptTR,
        excerptEN,
        `${dept.university_name} ${dept.city} - ${countryTR}'da ${dept.name_tr} okumak: ücretler, burslar, başvuru süreci, kabul şartları ve öğrenci yaşamı rehberi.`.substring(0, 155),
        `${dept.university_name} ${dept.city} - Study ${dept.name_en || dept.name_tr} in ${countryEN}: tuition fees, scholarships, admission requirements and student life guide.`.substring(0, 155),
        `VG Danışmanlık, vgdanismanlik, ${dept.university_name}, ${dept.university_name} ${countryTR}, ${dept.university_name} kabul şartları, ${dept.university_name} ücretleri, ${dept.name_tr}, ${countryTR}, ${dept.city}, yurtdışı eğitim, eğitim danışmanlığı`,
        'department',
        dept.university_id,
        dept.country,
        imageUrl,
        isPublished
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
async function generateContent(dept, lang, countryName, ytVideo) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    
    const deptName = lang === 'en' ? (dept.name_en || dept.name_tr) : dept.name_tr;
    const countryEN = COUNTRY_NAMES[dept.country]?.en || dept.country;
    const countrySlug = COUNTRY_STUDENT_LIFE_SLUGS[dept.country] || '';
    const countryGuideLink = countrySlug ? `/ulkede-universite/${countrySlug}` : '';
    
    const ytInstruction = ytVideo
        ? (lang === 'tr'
            ? `\nYOUTUBE VIDEO: Aşağıdaki videoyu makalenin 3. başlığından sonra doğal bir geçişle yerleştir:\n<div class="youtube-embed"><iframe src="https://www.youtube-nocookie.com/embed/${ytVideo.videoId}" title="${ytVideo.title}" allowfullscreen loading="lazy"></iframe></div>\nVideoyu tanıtan kısa bir cümle ekle (ör. "Aşağıdaki videoda ${dept.university_name} kampüsünü ve öğrenci deneyimlerini görebilirsiniz:").`
            : `\nYOUTUBE VIDEO: Embed the following video naturally after the 3rd heading:\n<div class="youtube-embed"><iframe src="https://www.youtube-nocookie.com/embed/${ytVideo.videoId}" title="${ytVideo.title}" allowfullscreen loading="lazy"></iframe></div>\nAdd a brief introductory sentence (e.g. "Watch the video below to get a glimpse of life at ${dept.university_name}:").`)
        : '';

    const systemPrompt = lang === 'tr' 
        ? `Sen deneyimli bir yurt dışı eğitim blog yazarısın. VG Danışmanlık Eğitim Danışmanlığı için yazıyorsun. Şirketin ismi "VG Danışmanlık" — bu ismi kullan. Yazın samimi, bilgilendirici ve gerçek bir insan tarafından yazılmış gibi olsun — yapay zeka tarafından yazıldığı belli olmasın. SADECE h2, h3, p, ul, li, strong, a, table, thead, tbody, tr, th, td, div, iframe tagleri kullan. html, head, body, title tagleri KULLANMA. Sadece Türkçe ve Latin karakterler kullan.`
        : `You are an experienced study-abroad blog writer for VG Danışmanlık Education Consultancy. Write in a genuine, human tone — it should NOT sound AI-generated. Use ONLY h2, h3, p, ul, li, strong, a, table, thead, tbody, tr, th, td, div, iframe tags. DO NOT use html, head, body, title tags. Use ONLY English and Latin characters.`;

    const prompt = lang === 'tr' 
        ? `${countryName}'da ${dept.name_tr} okumanın tüm detaylarını anlatan kapsamlı bir Türkçe blog makalesi yaz.

KONU: ${countryName}'da ${dept.name_tr} Okumak — ${dept.university_name}
Şehir: ${dept.city} | Ülke: ${countryName}
${dept.price ? `Yıllık Ücret: ${dept.price} ${dept.currency || 'EUR'}` : ''}

YAPI (bu başlıkları kullan, H2/H3 etiketleriyle):
1. Giriş — Neden ${countryName}'da ${dept.name_tr} okumalısın? (merak uyandıran, samimi)
2. ${countryName}'da ${dept.name_tr} Bölümü: Ne Öğrenirsin, Kariyer Fırsatları Neler?
3. ${dept.university_name} Hakkında — Neden Bu Üniversite?
4. ${countryName}'da Öğrenci Yaşamı ve Yaşam Maliyetleri (somut rakamlar ver — <table> kullan)
5. Başvuru Süreci ve Gerekli Belgeler
6. Burs ve Finansal Destek İmkanları (varsa ülkeye özgü burs isimlerini say: DAAD, Stipendium Hungaricum, DSU vb.)
7. VG Danışmanlık ile Başvuru Süreci
${ytInstruction}

KURALLAR:
1. 800-1100 kelime — kısa ve yüzeysel değil, gerçekten bilgilendirici yaz
2. Şu anahtar kelimeleri DOĞAL şekilde dağıt (zorlama yapma): "${dept.university_name}", "${dept.university_name} ${countryName}", "${dept.university_name} ${dept.name_tr.toLowerCase()}", "yurtdışında ${dept.name_tr.toLowerCase()} okumak", "${countryName}'da ${dept.name_tr.toLowerCase()} bölümü", "yurt dışı eğitim danışmanlığı", "${dept.city} üniversite"
3. ÖNEMLİ: Üniversite ismini ("${dept.university_name}") makalenin ilk paragrafında, ortasında ve sonuç paragrafında mutlaka kullan. Ülke ismini ("${countryName}") ve şehir ismini ("${dept.city}") de sık sık geçir — Google'da bu isimlerle aranıldığında makalenin çıkması gerekiyor
4. Şirket ismi olarak SADECE "VG Danışmanlık" kullan (toplam 3-4 kez)
5. Son bölümde "VG Danışmanlık ile iletişime geçebilirsiniz" şeklinde CTA ekle
6. Bu bir LİSANS programıdır, yüksek lisans değil
7. Rakamlar ve somut bilgiler kullan — vize süresi, yaşam maliyeti, ücret miktarı, QS ranking (varsa), öğrenci sayısı, kabul oranı
8. Yaşam maliyeti bölümünde bir <table> ile şehir bazlı karşılaştırma yap (kira, yemek, ulaşım gibi kalemler)
9. Makalenin içerisine şu üç linki doğal şekilde yerleştir:
   - <a href="STUDENT_LIFE_LINK">${countryName}'de Öğrenci Hayatı</a>
   - <a href="UNIVERSITY_DETAIL_LINK">${dept.university_name} hakkında detaylı bilgi</a>${countryGuideLink ? `\n   - <a href="${countryGuideLink}">${countryName}'da Üniversite Eğitimi Rehberi</a>` : ''}
10. Makale sonunda 3-4 soruluk kısa bir SSS/FAQ bölümü ekle (<h3>Sık Sorulan Sorular</h3> altında)

FORMAT: HTML tagleri: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <a>, <table>, <thead>, <tbody>, <tr>, <th>, <td>. YouTube embed için: <div class="youtube-embed"><iframe>...</iframe></div>. Markdown KULLANMA. Kod bloğu EKLEME. Direkt içerikle başla.`
        : `Write a comprehensive English blog article about studying ${deptName} in ${countryEN}.

TOPIC: Studying ${deptName} in ${countryEN} — ${dept.university_name}
City: ${dept.city} | Country: ${countryEN}
${dept.price ? `Annual Fee: ${dept.price} ${dept.currency || 'EUR'}` : ''}

STRUCTURE (use these H2/H3 headings):
1. Introduction — Why study ${deptName} in ${countryEN}? (engaging, genuine)
2. ${deptName} in ${countryEN}: What You'll Learn & Career Opportunities
3. About ${dept.university_name} — Why This University?
4. Student Life & Cost of Living in ${countryEN} (concrete numbers — use a <table>)
5. Application Process & Required Documents
6. Scholarships & Financial Aid (name country-specific scholarships: DAAD, Stipendium Hungaricum, DSU etc.)
7. Apply with VG Danışmanlık
${ytInstruction}

RULES:
1. 800-1100 words — genuinely informative, not shallow
2. Naturally include keywords: "${dept.university_name}", "${dept.university_name} ${countryEN}", "study ${deptName.toLowerCase()} abroad", "studying in ${countryEN}", "${dept.city} university", "education consultancy"
3. IMPORTANT: Mention the university name ("${dept.university_name}") in the first paragraph, middle, and conclusion. Also frequently mention the country ("${countryEN}") and city ("${dept.city}")
4. Use ONLY "VG Danışmanlık" as the company name (3-4 times total)
5. End with a CTA: "Contact VG Danışmanlık for more information"
6. This is a BACHELOR'S / UNDERGRADUATE program
7. Use concrete facts — visa duration, living costs, tuition amounts, QS ranking (if applicable), student count, acceptance rate
8. Include a <table> in the cost of living section comparing rent, food, transport
9. Include these three links naturally:
   - <a href="STUDENT_LIFE_LINK">Student Life in ${countryEN}</a>
   - <a href="UNIVERSITY_DETAIL_LINK">Learn more about ${dept.university_name}</a>${countryGuideLink ? `\n   - <a href="${countryGuideLink}">Complete Guide to Studying in ${countryEN}</a>` : ''}
10. Add a short FAQ section at the end with 3-4 questions (<h3>Frequently Asked Questions</h3>)

FORMAT: HTML tags: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <a>, <table>, <thead>, <tbody>, <tr>, <th>, <td>. For YouTube embed: <div class="youtube-embed"><iframe>...</iframe></div>. NO Markdown. NO code blocks. Start directly with content.`;

    console.log('🌐 Calling Anthropic Claude API...');
    console.log('🔑 API Key present:', !!apiKey);
    console.log('📝 Language:', lang);
    
    let response;
    try {
        response = await fetch(ANTHROPIC_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7
            })
        });
    } catch (fetchErr) {
        console.error('❌ Fetch error:', fetchErr.message);
        throw new Error(`Network error calling Anthropic API: ${fetchErr.message}`);
    }
    
    console.log('📡 Anthropic API response status:', response.status);
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Anthropic API error response:', errorText);
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('✅ Anthropic API response received');
    let content = (data.content && data.content[0] && data.content[0].text) || '';
    content = stripUnwantedCharacters(content);
    
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
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h2>$1</h2>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .trim();
    
    // Post-processing: Replace internal link placeholders with real URLs
    const studentLifeSlug = COUNTRY_STUDENT_LIFE_SLUGS[dept.country] || '';
    const studentLifeUrl = studentLifeSlug ? `${OGRENCI_YASAMI_BASE}/${studentLifeSlug}` : '';
    const universityDetailUrl = dept.university_slug ? `/universities/${dept.university_slug}` : `/c/${dept.university_id}`;

    content = content.replace(/STUDENT_LIFE_LINK/g, studentLifeUrl);
    content = content.replace(/UNIVERSITY_DETAIL_LINK/g, universityDetailUrl);

    const hasStudentLifeLink = content.includes(OGRENCI_YASAMI_BASE + '/');
    const hasUniversityLink = content.includes('/universities/') || content.includes(`/c/${dept.university_id}`);

    if (!hasStudentLifeLink || !hasUniversityLink) {
        const countryNameTr = COUNTRY_NAMES[dept.country]?.tr || dept.country;
        const countryNameEn = COUNTRY_NAMES[dept.country]?.en || dept.country;
        let linksHtml = lang === 'tr' ? '<h3>İlgili Sayfalar</h3><ul>' : '<h3>Related Pages</h3><ul>';
        
        if (!hasStudentLifeLink && studentLifeUrl) {
            linksHtml += lang === 'tr'
                ? `<li><a href="${studentLifeUrl}">${countryNameTr}'de Öğrenci Hayatı</a></li>`
                : `<li><a href="${studentLifeUrl}">Student Life in ${countryNameEn}</a></li>`;
        }
        if (!hasUniversityLink) {
            linksHtml += lang === 'tr'
                ? `<li><a href="${universityDetailUrl}">${dept.university_name} hakkında detaylı bilgi</a></li>`
                : `<li><a href="${universityDetailUrl}">Learn more about ${dept.university_name}</a></li>`;
        }
        linksHtml += '</ul>';
        content += linksHtml;
    }
    
    return content;
}

/**
 * SEO uyumlu Türkçe URL slug (Türkçe aramalarda öne çıkmak için Türkçe başlıktan üretilir)
 */
function createSlug(text) {
    const chars = { 'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U', 'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C' };
    let slug = (text || '').toLowerCase();
    for (const [tr, en] of Object.entries(chars)) {
        slug = slug.replace(new RegExp(tr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), en);
    }
    return slug.replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 80);
}

async function ensureUniqueSlug(baseSlug) {
    let slug = baseSlug;
    let n = 1;
    for (;;) {
        const r = await pool.query('SELECT 1 FROM blog_posts WHERE slug = $1', [slug]);
        if (r.rows.length === 0) return slug;
        slug = `${baseSlug}-${++n}`;
    }
}

// Export functions
async function getBlogPosts(limit = 20, offset = 0) {
    const result = await pool.query(`
        SELECT bp.id, bp.title_tr, bp.title_en, bp.slug, bp.excerpt_tr, bp.excerpt_en,
               bp.featured_image_url, bp.topic_type, bp.related_country,
               bp.published_at, bp.view_count, bp.related_university_id,
               u.logo_url as university_logo, u.name as university_name_tr, u.name_en as university_name_en
        FROM blog_posts bp
        LEFT JOIN universities u ON bp.related_university_id = u.id
        WHERE bp.is_published = true
        ORDER BY bp.published_at DESC LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return result.rows;
}

async function getBlogPostBySlug(slug) {
    const result = await pool.query(`
        SELECT bp.*, u.logo_url as university_logo, u.name as university_name_tr, u.name_en as university_name_en
        FROM blog_posts bp
        LEFT JOIN universities u ON bp.related_university_id = u.id
        WHERE bp.slug = $1 AND bp.is_published = true
    `, [slug]);
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

module.exports = { generateBlogPost, getBlogPosts, getBlogPostBySlug, getBlogPostCount, getRelatedPosts, findYouTubeVideo, COUNTRY_NAMES, COUNTRY_STUDENT_LIFE_SLUGS };

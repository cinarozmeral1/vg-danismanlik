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
 * Strip "AI-style" punctuation that signals machine-generated text.
 * - Em-dash (—, U+2014), en-dash (–, U+2013), horizontal bar (―, U+2015)
 *   → colon (": ") because plain hyphens still read as AI/list separators.
 *   Inside HTML tag attributes (between < >) we leave content untouched.
 * - Smart quotes ("" '') → straight quotes
 * Used both for newly generated content and for cleaning legacy posts.
 */
function stripAIPunctuation(text) {
    if (!text || typeof text !== 'string') return text;
    // Split on HTML tags so we don't touch attribute values like aria-label
    // or class names that may legitimately contain dashes.
    const parts = text.split(/(<[^>]+>)/g);
    return parts
        .map((part, idx) => {
            if (idx % 2 === 1) return part; // HTML tag — leave alone
            return part
                .replace(/\s*[—–―]\s*/g, ': ')
                .replace(/[\u2018\u2019]/g, "'")
                .replace(/[\u201C\u201D]/g, '"')
                .replace(/:\s*:/g, ':')
                .replace(/[ \t]{2,}/g, ' ');
        })
        .join('');
}

module.exports.stripAIPunctuation = stripAIPunctuation;

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
    'Netherlands',
    'Spain',
    'France'
];

const COUNTRY_NAMES = {
    'Czech Republic': { tr: 'Çek Cumhuriyeti', en: 'Czech Republic' },
    'Italy': { tr: 'İtalya', en: 'Italy' },
    'UK': { tr: 'İngiltere', en: 'United Kingdom' },
    'Germany': { tr: 'Almanya', en: 'Germany' },
    'Austria': { tr: 'Avusturya', en: 'Austria' },
    'Hungary': { tr: 'Macaristan', en: 'Hungary' },
    'Poland': { tr: 'Polonya', en: 'Poland' },
    'Netherlands': { tr: 'Hollanda', en: 'Netherlands' },
    'Spain': { tr: 'İspanya', en: 'Spain' },
    'France': { tr: 'Fransa', en: 'France' }
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
    'Netherlands': 'hollanda',
    'Spain': 'ispanya',
    'France': 'fransa'
};
const OGRENCI_YASAMI_BASE = '/ogrenci-yasami';

// City / region name translations used to convert university names into
// natural Turkish (e.g. "University of Vienna" → "Viyana Üniversitesi").
// Keys are matched case-insensitively as whole words.
const CITY_TR_MAP = {
    'Vienna': 'Viyana',
    'Munich': 'Münih',
    'Cologne': 'Köln',
    'Athens': 'Atina',
    'Rome': 'Roma',
    'Florence': 'Floransa',
    'Naples': 'Napoli',
    'Milan': 'Milano',
    'Venice': 'Venedik',
    'Genoa': 'Cenova',
    'Turin': 'Torino',
    'Prague': 'Prag',
    'Brno': 'Brno',
    'Warsaw': 'Varşova',
    'Krakow': 'Krakov',
    'Cracow': 'Krakov',
    'Wroclaw': 'Vrotslav',
    'Lodz': 'Lodz',
    'London': 'Londra',
    'Edinburgh': 'Edinburg',
    'Oxford': 'Oxford',
    'Cambridge': 'Cambridge',
    'Manchester': 'Manchester',
    'Liverpool': 'Liverpool',
    'Bristol': 'Bristol',
    'Glasgow': 'Glasgow',
    'Birmingham': 'Birmingham',
    'Paris': 'Paris',
    'Lyon': 'Lyon',
    'Marseille': 'Marsilya',
    'Bordeaux': 'Bordo',
    'Toulouse': 'Toulouse',
    'Nice': 'Nice',
    'Strasbourg': 'Strazburg',
    'Madrid': 'Madrid',
    'Barcelona': 'Barselona',
    'Seville': 'Sevilla',
    'Valencia': 'Valensiya',
    'Granada': 'Granada',
    'Salamanca': 'Salamanca',
    'Amsterdam': 'Amsterdam',
    'Rotterdam': 'Rotterdam',
    'The Hague': 'Lahey',
    'Utrecht': 'Utrecht',
    'Leiden': 'Leiden',
    'Groningen': 'Groningen',
    'Maastricht': 'Maastricht',
    'Budapest': 'Budapeşte',
    'Debrecen': 'Debrecen',
    'Szeged': 'Szeged',
    'Berlin': 'Berlin',
    'Hamburg': 'Hamburg',
    'Frankfurt': 'Frankfurt',
    'Stuttgart': 'Stuttgart',
    'Dusseldorf': 'Düsseldorf',
    'Düsseldorf': 'Düsseldorf',
    'Heidelberg': 'Heidelberg',
    'Leipzig': 'Leipzig',
    'Bonn': 'Bonn',
    'Salzburg': 'Salzburg',
    'Graz': 'Graz',
    'Innsbruck': 'Innsbruck'
};

/**
 * Convert an English / native-language university name into a natural
 * Turkish name. Used so AI-generated TR articles read like they were
 * written for Turkish search intent (e.g. people Googling "Bologna
 * Üniversitesi işletme" should land on our article).
 *
 * Heuristics — applied in order:
 *   1. "University of X"           → "X Üniversitesi"
 *   2. "X University"              → "X Üniversitesi"
 *   3. "Università di X" / "Universidad de X" / "Université de X" /
 *      "Universität X"             → "X Üniversitesi"
 *   4. "Technical University of X" → "X Teknik Üniversitesi"
 *   5. "X Business School" / "X School of Business"
 *                                  → "X İşletme Okulu"
 *   6. "X College"                 → "X Koleji"
 *   7. "X Institute of Technology" → "X Teknoloji Enstitüsü"
 *   8. Translate any city tokens via CITY_TR_MAP
 *   9. If nothing matched, return the original name unchanged.
 */
function getUniversityTurkishName(name) {
    if (!name || typeof name !== 'string') return name;
    let out = name.trim();

    const translateCities = (s) => {
        let r = s;
        for (const [en, tr] of Object.entries(CITY_TR_MAP)) {
            const re = new RegExp(`\\b${en.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'gi');
            r = r.replace(re, tr);
        }
        return r;
    };

    // Patterns ordered most-specific → least-specific
    const patterns = [
        // "Technical University of X" → "X Teknik Üniversitesi"
        { re: /^Technical University of (.+)$/i,            build: m => `${translateCities(m[1])} Teknik Üniversitesi` },
        // "X Technical University" → "X Teknik Üniversitesi" (e.g. "Czech Technical University")
        { re: /^(.+?)\s+Technical University$/i,            build: m => `${translateCities(m[1].replace(/^Czech$/i, 'Çek'))} Teknik Üniversitesi` },
        // "X University of Applied Sciences" → "X Uygulamalı Bilimler Üniversitesi"
        { re: /^(.+?)\s+University of Applied Sciences$/i,  build: m => `${translateCities(m[1])} Uygulamalı Bilimler Üniversitesi` },
        // "X Medical University" → "X Tıp Üniversitesi"
        { re: /^(.+?)\s+Medical University$/i,              build: m => `${translateCities(m[1])} Tıp Üniversitesi` },
        // "X Institute of Technology" → "X Teknoloji Enstitüsü"
        { re: /^(.+?)\s+Institute of Technology$/i,         build: m => `${translateCities(m[1])} Teknoloji Enstitüsü` },
        // "X School of Business" → "X İşletme Okulu"
        { re: /^(.+?)\s+School of Business$/i,              build: m => `${translateCities(m[1])} İşletme Okulu` },
        // "X Business School" → "X İşletme Okulu"
        { re: /^(.+?)\s+Business School$/i,                 build: m => `${translateCities(m[1])} İşletme Okulu` },
        // "X School of Management" → "X Yönetim Okulu"
        { re: /^(.+?)\s+School of Management$/i,            build: m => `${translateCities(m[1])} Yönetim Okulu` },
        // "University College X" → "X Üniversite Koleji"
        { re: /^University College (.+)$/i,                 build: m => `${translateCities(m[1])} Üniversite Koleji` },
        // "X College" → "X Koleji"
        { re: /^(.+?)\s+College$/i,                         build: m => `${translateCities(m[1])} Koleji` },
        // "X University in Y" / "X University at Y" → "TranslatedY X Üniversitesi"
        { re: /^(.+?)\s+University\s+(?:in|at)\s+(.+)$/i,   build: m => {
            const cityKey = Object.keys(CITY_TR_MAP).find(c => c.toLowerCase() === m[2].toLowerCase());
            if (cityKey) return `${CITY_TR_MAP[cityKey]} ${m[1]} Üniversitesi`;
            return `${translateCities(m[2])} ${m[1]} Üniversitesi`;
        }},
        // "Sapienza University of Rome", "Vienna University of Economics" etc.
        // "X University of Y": if Y is a known city → "TranslatedY X Üniversitesi",
        //                     otherwise → "TranslatedX Üniversitesi" (X may itself be a city).
        { re: /^(.+?)\s+University of (.+)$/i,              build: m => {
            const left = m[1];
            const right = m[2];
            const cityKey = Object.keys(CITY_TR_MAP).find(c => c.toLowerCase() === right.toLowerCase());
            if (cityKey) return `${CITY_TR_MAP[cityKey]} ${left} Üniversitesi`;
            return `${translateCities(left)} Üniversitesi`;
        }},
        // "X Università di Y" → "Y X Üniversitesi" when Y is a city. MUST come before
        // the bare "Università di Y" pattern because that one only requires the prefix.
        { re: /^(\S.+?)\s+Università\s+(?:degli\s+Studi\s+)?di\s+(.+)$/i, build: m => {
            const cityKey = Object.keys(CITY_TR_MAP).find(c => c.toLowerCase() === m[2].toLowerCase());
            if (cityKey) return `${CITY_TR_MAP[cityKey]} ${m[1]} Üniversitesi`;
            return `${translateCities(m[2])} ${m[1]} Üniversitesi`;
        }},
        // "Università di X" / "Università degli Studi di X"
        { re: /^Università\s+(?:degli\s+Studi\s+)?di\s+(.+)$/i, build: m => `${translateCities(m[1])} Üniversitesi` },
        // "Universidad Autónoma de X" / "Universidad Carlos III de X" / "Universidad de X"
        // Anything between "Universidad" and " de " is a qualifier we want to keep.
        { re: /^Universidad\s+(?:(.+?)\s+)?de\s+(.+)$/i,    build: m => {
            const qual = (m[1] || '').trim();
            const city = translateCities(m[2]);
            return qual ? `${city} ${qual} Üniversitesi` : `${city} Üniversitesi`;
        }},
        // "Université de X" / "Université Paris X"
        { re: /^Université\s+(?:de\s+)?(.+)$/i,             build: m => `${translateCities(m[1])} Üniversitesi` },
        // "Universität X" (German)
        { re: /^Universität\s+(.+)$/i,                      build: m => `${translateCities(m[1])} Üniversitesi` },
        // "Univerzita Karlova" → "Charles Üniversitesi" handled as special case
        { re: /^Univerzita\s+Karlova/i,                     build: () => 'Charles Üniversitesi' },
        // Other "Univerzita X" (Czech)
        { re: /^Univerzita\s+(.+)$/i,                       build: m => `${translateCities(m[1])} Üniversitesi` },
        // "Uniwersytet Warszawski" → "Varşova Üniversitesi" special case
        { re: /^Uniwersytet\s+Warszawski/i,                 build: () => 'Varşova Üniversitesi' },
        // "Uniwersytet Jagielloński" → "Jagiellonian Üniversitesi"
        { re: /^Uniwersytet\s+Jagiello[nń]ski/i,            build: () => 'Jagiellonian Üniversitesi' },
        // Other "Uniwersytet X" (Polish)
        { re: /^Uniwersytet\s+(.+)$/i,                      build: m => `${translateCities(m[1])} Üniversitesi` },
        // "Universiteit X" (Dutch)
        { re: /^Universiteit\s+(.+)$/i,                     build: m => `${translateCities(m[1])} Üniversitesi` },
        // "X Universiteit" (Dutch reverse)
        { re: /^(.+?)\s+Universiteit$/i,                    build: m => `${translateCities(m[1])} Üniversitesi` },
        // "University of X"
        { re: /^University of (.+)$/i,                      build: m => `${translateCities(m[1])} Üniversitesi` },
        // "X University" (must come after "Technical University of X")
        { re: /^(.+?)\s+University$/i,                      build: m => `${translateCities(m[1])} Üniversitesi` }
    ];

    for (const { re, build } of patterns) {
        const m = out.match(re);
        if (m) return build(m).replace(/\s{2,}/g, ' ').trim();
    }

    // Fallback: just translate any embedded city names; if the name
    // contains the word "University" anywhere, swap it with "Üniversitesi"
    const cityTranslated = translateCities(out);
    if (/\bUniversity\b/i.test(cityTranslated)) {
        return cityTranslated.replace(/\bUniversity\b/gi, 'Üniversitesi');
    }
    return cityTranslated;
}

module.exports.getUniversityTurkishName = getUniversityTurkishName;

/**
 * Brand-only short slug for acronym-named institutions whose Turkish
 * "translation" would feel forced. Returns just the acronym in lowercase.
 *
 * Triggers when the original name starts with a 2-6 letter ACRONYM
 * followed only by a generic institutional suffix:
 *   "ESADE Business School"      → "esade"
 *   "IE University"              → "ie"
 *   "EMLYON Business School"     → "emlyon"
 *   "EDHEC Business School"      → "edhec"
 *   "IÉSEG School of Management" → "ieseg"
 *   "ESCP Business School"       → "escp"
 *   "INSEAD"                     → "insead"
 *
 * Returns null when the name does NOT look brand-only (e.g. "Charles University",
 * "University of Bologna", "Sapienza University of Rome"). The caller should
 * fall back to getUniversityTurkishName + slugify in that case.
 */
function getUniversityBrandSlug(name) {
    if (!name || typeof name !== 'string') return null;
    const trimmed = name.trim();
    // Strip diacritics for the acronym check so "IÉSEG" matches as IESEG.
    const stripDiacritics = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const tokens = trimmed.split(/\s+/);
    if (tokens.length === 0) return null;
    const firstAscii = stripDiacritics(tokens[0]);
    // Acronym: 2-6 letters, all uppercase (after diacritic stripping)
    if (!/^[A-Z]{2,6}$/.test(firstAscii)) return null;
    // Standalone acronym university (e.g. "INSEAD")
    if (tokens.length === 1) return firstAscii.toLowerCase();
    const rest = tokens.slice(1).join(' ').toLowerCase().trim();
    const validSuffixes = [
        'business school',
        'business',
        'school of business',
        'school of management',
        'school of economics',
        'university',
        'institute',
        'institute of technology'
    ];
    if (validSuffixes.includes(rest)) return firstAscii.toLowerCase();
    return null;
}

module.exports.getUniversityBrandSlug = getUniversityBrandSlug;

/**
 * Latin-only slug builder. Maps Turkish + common European diacritics to
 * ASCII equivalents and removes anything else.
 */
function slugifyLatin(text) {
    if (!text) return '';
    return String(text)
        .toLowerCase()
        .replace(/ı/g, 'i').replace(/İ/gi, 'i')
        .replace(/ş/g, 's').replace(/ğ/g, 'g')
        .replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u')
        // Latinize remaining diacritics (é, à, ñ, ł, č, ž, etc.)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/ł/g, 'l').replace(/Ł/gi, 'l')
        .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 80);
}

/**
 * Build a Türkçe-friendly URL slug for a university.
 *
 * Strategy:
 *   1. If the name looks brand-only (ESADE, IE, …) → return the bare acronym.
 *   2. Otherwise compute the Turkish display name via getUniversityTurkishName
 *      and slugify it. If the resulting slug doesn't already contain the city,
 *      we append the city for uniqueness/clarity.
 *
 * The caller is responsible for calling ensureUniqueSlug() to avoid
 * collisions across rows.
 */
function buildTurkishUniversitySlug(name, city) {
    const brand = getUniversityBrandSlug(name);
    if (brand) {
        // For brand-only slugs we DO add the city when we have one, to keep
        // URLs unique and richer (e.g. "hec-paris", "ie-madrid", "esade-barselona").
        const citySlug = city ? slugifyLatin(getUniversityTurkishName(city) || city) : '';
        if (citySlug && !brand.includes(citySlug)) {
            return `${brand}-${citySlug}`;
        }
        return brand;
    }
    const trName = getUniversityTurkishName(name) || name;
    let slug = slugifyLatin(trName);
    const citySlug = city ? slugifyLatin(getUniversityTurkishName(city) || city) : '';
    // Avoid duplicating the city when the name already ends with it
    // (e.g. "Bologna Üniversitesi" + city "Bologna" → keep "bologna-universitesi").
    if (citySlug && !slug.split('-').includes(citySlug)) {
        slug = `${slug}-${citySlug}`;
    }
    return slug.substring(0, 80);
}

module.exports.buildTurkishUniversitySlug = buildTurkishUniversitySlug;
module.exports.slugifyLatin = slugifyLatin;

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
    
    // Resolve a Turkish version of the university name. Used in the TR
    // title, slug, prompt and meta so Google searches like
    // "Bologna Üniversitesi işletme bölümü" surface our article.
    const universityNameTR = getUniversityTurkishName(dept.university_name);
    const universityNameEN = dept.university_name;
    console.log(`🏫 University TR name: "${universityNameTR}" (from "${universityNameEN}")`);

    console.log('🤖 Generating Turkish content...');
    const contentTR = stripAIPunctuation(await generateContent(dept, 'tr', countryTR, ytVideo, universityNameTR));
    
    console.log('🤖 Generating English content...');
    const contentEN = stripAIPunctuation(await generateContent(dept, 'en', countryEN, ytVideo, universityNameEN));
    
    // Excerpts ve SEO uyumlu Türkçe slug (her makaleye özel URL)
    const excerptTR = stripAIPunctuation(contentTR.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 180)) + '...';
    const excerptEN = stripAIPunctuation(contentEN.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 180)) + '...';
    
    const titleTR = stripAIPunctuation(`${universityNameTR}: ${countryTR}'da ${dept.name_tr} Okumak | ${dept.city}`);
    const titleEN = stripAIPunctuation(`${universityNameEN}: Studying ${dept.name_en || dept.name_tr} in ${countryEN} | ${dept.city}`);

    // Slug is built from the Turkish university + Turkish department name
    // so the URL itself reads naturally in Turkish (best Turkish SEO).
    const baseSlug = createSlug(`${universityNameTR}-${dept.name_tr}-${dept.city}`);
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
        stripAIPunctuation(`${universityNameTR}, ${dept.city}: ${countryTR}'da ${dept.name_tr} okumak. Ücretler, burslar, başvuru süreci, kabul şartları ve öğrenci yaşamı rehberi.`).substring(0, 155),
        stripAIPunctuation(`${universityNameEN}, ${dept.city}: Study ${dept.name_en || dept.name_tr} in ${countryEN}. Tuition fees, scholarships, admission requirements and student life guide.`).substring(0, 155),
        `VG Danışmanlık, vgdanismanlik, ${universityNameTR}, ${universityNameEN}, ${universityNameTR} ${dept.name_tr}, ${universityNameTR} kabul şartları, ${universityNameTR} ücretleri, ${dept.name_tr}, ${countryTR}, ${dept.city}, yurtdışı eğitim, eğitim danışmanlığı`,
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
 * Generate content in specified language.
 * @param {object} dept Department row from DB
 * @param {'tr'|'en'} lang Output language
 * @param {string} countryName Country name in target language
 * @param {object|null} ytVideo Optional YouTube video info
 * @param {string} [universityName] Localized university name (Turkish or English).
 *                                  Falls back to dept.university_name when omitted.
 */
async function generateContent(dept, lang, countryName, ytVideo, universityName) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    
    const deptName = lang === 'en' ? (dept.name_en || dept.name_tr) : dept.name_tr;
    const uniName = universityName || dept.university_name;
    const uniNameOriginal = dept.university_name; // for clarity / English fallback
    const countryEN = COUNTRY_NAMES[dept.country]?.en || dept.country;
    const countrySlug = COUNTRY_STUDENT_LIFE_SLUGS[dept.country] || '';
    const countryGuideLink = countrySlug ? `/ulkede-universite/${countrySlug}` : '';
    
    const ytInstruction = ytVideo
        ? (lang === 'tr'
            ? `\nYOUTUBE VIDEO: Aşağıdaki videoyu makalenin 3. başlığından sonra doğal bir geçişle yerleştir:\n<div class="youtube-embed"><iframe src="https://www.youtube-nocookie.com/embed/${ytVideo.videoId}" title="${ytVideo.title}" allowfullscreen loading="lazy"></iframe></div>\nVideoyu tanıtan kısa bir cümle ekle (ör. "Aşağıdaki videoda ${uniName} kampüsünü ve öğrenci deneyimlerini görebilirsiniz:").`
            : `\nYOUTUBE VIDEO: Embed the following video naturally after the 3rd heading:\n<div class="youtube-embed"><iframe src="https://www.youtube-nocookie.com/embed/${ytVideo.videoId}" title="${ytVideo.title}" allowfullscreen loading="lazy"></iframe></div>\nAdd a brief introductory sentence (e.g. "Watch the video below to get a glimpse of life at ${uniName}:").`)
        : '';

    const systemPrompt = lang === 'tr' 
        ? `Sen deneyimli bir yurt dışı eğitim blog yazarısın. VG Danışmanlık Eğitim Danışmanlığı için yazıyorsun. Şirketin ismi "VG Danışmanlık". Yazın samimi, bilgilendirici ve gerçek bir insan tarafından yazılmış gibi olsun, yapay zeka tarafından yazıldığı belli olmasın. ÇOK ÖNEMLİ: Uzun tire (em-dash "—"), kısa tire (en-dash "–") ve normal tire (-) ASLA cümle ortasında ayraç olarak kullanma. İki düşünceyi birbirine bağlamak gerekiyorsa virgül (,) veya iki nokta üst üste (:) kullan. Başlıklarda da tire koyma; bunun yerine iki nokta üst üste (:) kullan. Örnek doğru: "Giriş: Neden okumalısın?". Örnek YANLIŞ: "Giriş - Neden okumalısın?" veya "Giriş — Neden okumalısın?". Düz tırnak (' ve ") kullan, smart/curly quote kullanma. SADECE h2, h3, p, ul, li, strong, a, table, thead, tbody, tr, th, td, div, iframe tagleri kullan. html, head, body, title tagleri KULLANMA. Sadece Türkçe ve Latin karakterler kullan.`
        : `You are an experienced study-abroad blog writer for VG Danışmanlık Education Consultancy. Write in a genuine, human tone, it should NOT sound AI-generated. CRITICAL: NEVER use em-dash ("—"), en-dash ("–"), or even regular hyphens ("-") as a mid-sentence separator. To join two ideas, use a comma (,) or a colon (:). In headings do NOT use any dash; use a colon (:) instead. Correct example: "Introduction: Why study here?". WRONG example: "Introduction - Why study here?" or "Introduction — Why study here?". Use straight quotes (' and ") instead of smart/curly quotes. Use ONLY h2, h3, p, ul, li, strong, a, table, thead, tbody, tr, th, td, div, iframe tags. DO NOT use html, head, body, title tags. Use ONLY English and Latin characters.`;

    const prompt = lang === 'tr' 
        ? `${countryName}'da ${dept.name_tr} okumanın tüm detaylarını anlatan kapsamlı bir Türkçe blog makalesi yaz.

KONU: ${countryName}'da ${dept.name_tr} Okumak, ${uniName}
Şehir: ${dept.city} | Ülke: ${countryName}
Üniversitenin Türkçe adı: ${uniName} (orijinal: ${uniNameOriginal})
${dept.price ? `Yıllık Ücret: ${dept.price} ${dept.currency || 'EUR'}` : ''}

ÜNİVERSİTE ADI KULLANIMI (kritik):
- Tüm makale boyunca üniversitenin TÜRKÇE adını ("${uniName}") kullan. İngilizce orijinal ad ("${uniNameOriginal}") YALNIZCA ilk geçişte parantez içinde verilmeli, ör. "${uniName} (${uniNameOriginal})". Sonraki tüm geçişlerde sadece "${uniName}" yaz.
- Tüm başlıklarda Türkçe ad kullan.

YAPI (bu başlıkları kullan, H2/H3 etiketleriyle, başlıklarda asla tire kullanma):
1. Giriş: Neden ${countryName}'da ${dept.name_tr} okumalısın? (merak uyandıran, samimi)
2. ${countryName}'da ${dept.name_tr} Bölümü: Ne Öğrenirsin, Kariyer Fırsatları Neler?
3. ${uniName} Hakkında: Neden Bu Üniversite?
4. ${countryName}'da Öğrenci Yaşamı ve Yaşam Maliyetleri (somut rakamlar ver, <table> kullan)
5. Başvuru Süreci ve Gerekli Belgeler
6. Burs ve Finansal Destek İmkanları (varsa ülkeye özgü burs isimlerini say: DAAD, Stipendium Hungaricum, DSU vb.)
7. VG Danışmanlık ile Başvuru Süreci
${ytInstruction}

KURALLAR:
1. 800-1100 kelime, kısa ve yüzeysel değil, gerçekten bilgilendirici yaz
2. Şu anahtar kelimeleri DOĞAL şekilde dağıt (zorlama yapma): "${uniName}", "${uniName} ${countryName}", "${uniName} ${dept.name_tr.toLowerCase()}", "${uniName} ${dept.name_tr.toLowerCase()} bölümü", "yurtdışında ${dept.name_tr.toLowerCase()} okumak", "${countryName}'da ${dept.name_tr.toLowerCase()} bölümü", "yurt dışı eğitim danışmanlığı", "${dept.city} üniversite"
3. ÖNEMLİ: Türkçe üniversite ismini ("${uniName}") makalenin ilk paragrafında, ortasında ve sonuç paragrafında mutlaka kullan. Ülke ismini ("${countryName}") ve şehir ismini ("${dept.city}") de sık sık geçir, Google'da bu isimlerle aranıldığında makalenin çıkması gerekiyor
4. Şirket ismi olarak SADECE "VG Danışmanlık" kullan (toplam 3-4 kez)
5. Son bölümde "VG Danışmanlık ile iletişime geçebilirsiniz" şeklinde CTA ekle
6. Bu bir LİSANS programıdır, yüksek lisans değil
7. Rakamlar ve somut bilgiler kullan: vize süresi, yaşam maliyeti, ücret miktarı, QS ranking (varsa), öğrenci sayısı, kabul oranı
8. Yaşam maliyeti bölümünde bir <table> ile şehir bazlı karşılaştırma yap (kira, yemek, ulaşım gibi kalemler)
9. Makalenin içerisine şu üç linki doğal şekilde yerleştir:
   - <a href="STUDENT_LIFE_LINK">${countryName}'de Öğrenci Hayatı</a>
   - <a href="UNIVERSITY_DETAIL_LINK">${uniName} hakkında detaylı bilgi</a>${countryGuideLink ? `\n   - <a href="${countryGuideLink}">${countryName}'da Üniversite Eğitimi Rehberi</a>` : ''}
10. Makale sonunda 3-4 soruluk kısa bir SSS/FAQ bölümü ekle (<h3>Sık Sorulan Sorular</h3> altında)

FORMAT: HTML tagleri: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <a>, <table>, <thead>, <tbody>, <tr>, <th>, <td>. YouTube embed için: <div class="youtube-embed"><iframe>...</iframe></div>. Markdown KULLANMA. Kod bloğu EKLEME. Direkt içerikle başla.`
        : `Write a comprehensive English blog article about studying ${deptName} in ${countryEN}.

TOPIC: Studying ${deptName} in ${countryEN}, ${uniName}
City: ${dept.city} | Country: ${countryEN}
${dept.price ? `Annual Fee: ${dept.price} ${dept.currency || 'EUR'}` : ''}

STRUCTURE (use these H2/H3 headings, NEVER use a dash in headings):
1. Introduction: Why study ${deptName} in ${countryEN}? (engaging, genuine)
2. ${deptName} in ${countryEN}: What You'll Learn and Career Opportunities
3. About ${uniName}: Why This University?
4. Student Life and Cost of Living in ${countryEN} (concrete numbers, use a <table>)
5. Application Process & Required Documents
6. Scholarships & Financial Aid (name country-specific scholarships: DAAD, Stipendium Hungaricum, DSU etc.)
7. Apply with VG Danışmanlık
${ytInstruction}

RULES:
1. 800-1100 words, genuinely informative, not shallow
2. Naturally include keywords: "${uniName}", "${uniName} ${countryEN}", "study ${deptName.toLowerCase()} abroad", "studying in ${countryEN}", "${dept.city} university", "education consultancy"
3. IMPORTANT: Mention the university name ("${uniName}") in the first paragraph, middle, and conclusion. Also frequently mention the country ("${countryEN}") and city ("${dept.city}")
4. Use ONLY "VG Danışmanlık" as the company name (3-4 times total)
5. End with a CTA: "Contact VG Danışmanlık for more information"
6. This is a BACHELOR'S / UNDERGRADUATE program
7. Use concrete facts: visa duration, living costs, tuition amounts, QS ranking (if applicable), student count, acceptance rate
8. Include a <table> in the cost of living section comparing rent, food, transport
9. Include these three links naturally:
   - <a href="STUDENT_LIFE_LINK">Student Life in ${countryEN}</a>
   - <a href="UNIVERSITY_DETAIL_LINK">Learn more about ${uniName}</a>${countryGuideLink ? `\n   - <a href="${countryGuideLink}">Complete Guide to Studying in ${countryEN}</a>` : ''}
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
                ? `<li><a href="${universityDetailUrl}">${uniName} hakkında detaylı bilgi</a></li>`
                : `<li><a href="${universityDetailUrl}">Learn more about ${uniName}</a></li>`;
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

module.exports = { generateBlogPost, getBlogPosts, getBlogPostBySlug, getBlogPostCount, getRelatedPosts, findYouTubeVideo, COUNTRY_NAMES, COUNTRY_STUDENT_LIFE_SLUGS, stripAIPunctuation, getUniversityTurkishName, getUniversityBrandSlug, buildTurkishUniversitySlug, slugifyLatin };

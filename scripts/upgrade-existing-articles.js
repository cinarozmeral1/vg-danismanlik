require('dotenv').config();
const { Pool } = require('pg');
let ytsr;
try { ytsr = require('ytsr'); } catch { ytsr = null; }

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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

async function findYouTubeVideo(universityName, departmentName, countryTR) {
    if (!ytsr) return null;

    const searches = [
        `${universityName} ${departmentName}`,
        universityName,
        `${countryTR} üniversite eğitim`
    ];

    for (const query of searches) {
        try {
            const results = await ytsr(query, { limit: 3 });
            const video = results.items.find(i => i.type === 'video');
            if (video) {
                return { videoId: video.id, title: video.title };
            }
        } catch { /* skip */ }
    }
    return null;
}

function insertVideoEmbed(content, videoId, videoTitle, lang) {
    const embedHtml = `<div class="youtube-embed"><iframe src="https://www.youtube-nocookie.com/embed/${videoId}" title="${videoTitle.replace(/"/g, '&quot;')}" allowfullscreen loading="lazy"></iframe></div>`;
    const intro = lang === 'tr'
        ? `<p>Aşağıdaki videoda üniversite kampüsünü ve öğrenci deneyimlerini görebilirsiniz:</p>`
        : `<p>Watch the video below to get a glimpse of life at the university:</p>`;
    
    let h2Count = 0;
    const replaced = content.replace(/<\/h2>/gi, (match) => {
        h2Count++;
        if (h2Count === 3) {
            return `${match}\n${intro}\n${embedHtml}\n`;
        }
        return match;
    });
    
    if (h2Count >= 3) return replaced;
    return content + `\n${intro}\n${embedHtml}`;
}

async function run() {
    const dryRun = process.argv.includes('--dry-run');
    console.log(dryRun ? '🔍 DRY RUN — no DB changes' : '🚀 LIVE RUN — will update DB');

    const { rows: posts } = await pool.query(`
        SELECT bp.id, bp.title_tr, bp.title_en, bp.slug, bp.content_tr, bp.content_en,
               bp.meta_description_tr, bp.meta_description_en,
               bp.related_university_id, bp.related_country,
               u.name as university_name, u.city
        FROM blog_posts bp
        LEFT JOIN universities u ON bp.related_university_id = u.id
        WHERE bp.is_published = true
        ORDER BY bp.published_at DESC
    `);

    console.log(`📝 Found ${posts.length} published articles\n`);

    let updated = 0;
    for (const post of posts) {
        console.log(`--- [${post.id}] ${post.title_tr || post.slug} ---`);
        const changes = {};

        const countryTR = COUNTRY_NAMES[post.related_country]?.tr || post.related_country || '';
        const countryEN = COUNTRY_NAMES[post.related_country]?.en || post.related_country || '';
        const uniName = post.university_name || '';

        // Extract dept name from existing title if possible
        let deptTR = '';
        let deptEN = '';
        const trMatch = (post.title_tr || '').match(/['']da\s+(.+?)\s+Okumak/i) || (post.title_tr || '').match(/['']de\s+(.+?)\s+Okumak/i);
        if (trMatch) deptTR = trMatch[1];
        const enMatch = (post.title_en || '').match(/Studying\s+(.+?)\s+in\s/i);
        if (enMatch) deptEN = enMatch[1];

        // Only update title if it doesn't already follow the new format
        if (deptTR && uniName && !(post.title_tr || '').includes(uniName)) {
            changes.title_tr = `${countryTR}'da ${deptTR} Okumak: ${uniName}`;
        }
        if (deptEN && uniName && !(post.title_en || '').includes(uniName)) {
            changes.title_en = `Studying ${deptEN} in ${countryEN}: ${uniName}`;
        }

        // Better meta descriptions
        if (deptTR && countryTR && uniName) {
            const newMetaTR = `${countryTR}'da ${deptTR} okumak isteyenler için ${uniName} rehberi. Ücretler, burslar, başvuru süreci ve öğrenci yaşamı hakkında bilgi.`.substring(0, 155);
            if (newMetaTR !== post.meta_description_tr) {
                changes.meta_description_tr = newMetaTR;
            }
        }
        if (deptEN && countryEN && uniName) {
            const newMetaEN = `Complete guide to studying ${deptEN} at ${uniName} in ${countryEN}. Tuition, scholarships, application process and student life.`.substring(0, 155);
            if (newMetaEN !== post.meta_description_en) {
                changes.meta_description_en = newMetaEN;
            }
        }

        // YouTube embed (only if not already present)
        const hasYT_TR = (post.content_tr || '').includes('youtube-embed');
        const hasYT_EN = (post.content_en || '').includes('youtube-embed');

        if (!hasYT_TR || !hasYT_EN) {
            const searchTerm = deptTR || deptEN || uniName;
            const video = await findYouTubeVideo(uniName, searchTerm, countryTR);
            if (video) {
                console.log(`  🎬 Found video: ${video.title}`);
                if (!hasYT_TR && post.content_tr) {
                    changes.content_tr = insertVideoEmbed(post.content_tr, video.videoId, video.title, 'tr');
                }
                if (!hasYT_EN && post.content_en) {
                    changes.content_en = insertVideoEmbed(post.content_en, video.videoId, video.title, 'en');
                }
            }
            // Rate-limit YouTube API calls
            await new Promise(r => setTimeout(r, 200));
        } else {
            console.log('  ✅ YouTube embed already present');
        }

        const keys = Object.keys(changes);
        if (keys.length === 0) {
            console.log('  → No changes needed');
            continue;
        }

        console.log(`  → Changes: ${keys.join(', ')}`);
        for (const k of keys) {
            if (k.startsWith('content_')) {
                console.log(`    ${k}: [content updated with YouTube embed]`);
            } else {
                console.log(`    ${k}: "${changes[k]}"`);
            }
        }

        if (!dryRun) {
            const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
            const values = keys.map(k => changes[k]);
            values.push(post.id);
            await pool.query(`UPDATE blog_posts SET ${setClauses} WHERE id = $${values.length}`, values);
            console.log('  ✅ Updated in DB');
        }

        updated++;
    }

    console.log(`\n✅ Done! ${updated}/${posts.length} articles ${dryRun ? 'would be' : 'were'} updated.`);
    await pool.end();
}

run().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});

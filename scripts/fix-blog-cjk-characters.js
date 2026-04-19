#!/usr/bin/env node
/**
 * Blog makalelerindeki Çince/Japonca/Korece (CJK) ve istenmeyen karakterleri tespit edip temizler.
 * Çalıştırma: node scripts/fix-blog-cjk-characters.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// CJK ve benzeri karakter aralıkları (Çince, Japonca, Korece, vb.)
const CJK_REGEX = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u3100-\u312f\u31a0-\u31bf\uff00-\uffef]/g;

function stripUnwantedCharacters(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(CJK_REGEX, '');
}

async function main() {
    console.log('🔍 Blog makaleleri taranıyor (CJK/istenmeyen karakterler)...\n');
    const result = await pool.query(`
        SELECT id, slug, title_tr, title_en, content_tr, content_en, excerpt_tr, excerpt_en
        FROM blog_posts
    `);
    let updated = 0;
    const scanned = result.rows.length;
    for (const row of result.rows) {
        const fields = ['title_tr', 'title_en', 'content_tr', 'content_en', 'excerpt_tr', 'excerpt_en'];
        const cleaned = {};
        let changed = false;
        for (const key of fields) {
            const value = row[key];
            if (!value) {
                cleaned[key] = value;
                continue;
            }
            const stripped = stripUnwantedCharacters(value);
            const normalized = (key === 'content_tr' || key === 'content_en') ? stripped : stripped.replace(/\s+/g, ' ').trim();
            if (normalized !== value) changed = true;
            cleaned[key] = normalized;
        }
        if (!changed) continue;
        await pool.query(`
            UPDATE blog_posts SET
                title_tr = $2, title_en = $3, content_tr = $4, content_en = $5, excerpt_tr = $6, excerpt_en = $7,
                updated_at = NOW()
            WHERE id = $1
        `, [
            row.id,
            cleaned.title_tr,
            cleaned.title_en,
            cleaned.content_tr,
            cleaned.content_en,
            cleaned.excerpt_tr,
            cleaned.excerpt_en
        ]);
        updated++;
        console.log('✅ Güncellendi:', row.id, row.slug);
    }
    console.log('\n📊 Sonuç: %d makale tarandı, %d makale güncellendi.', scanned, updated);
    await pool.end();
}

main().catch(err => {
    console.error('Hata:', err);
    process.exit(1);
});

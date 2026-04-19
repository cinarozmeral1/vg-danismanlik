#!/usr/bin/env node
/**
 * Build a Google Ads Editor bulk import CSV that creates an entire DSA
 * (Dynamic Search Ads) campaign in one Post Changes click.
 *
 * Output file:  reports/google-ads/dsa-blog-campaign.csv
 *
 * The CSV uses Google Ads Editor's bulk import column headers. It creates:
 *   - 1 Search campaign:    "DSA - Blog Articles - All"
 *   - 1 ad group:           "Blog - All Articles"   (Dynamic, page feed targeted)
 *   - 1 dynamic search ad:  with two descriptions
 *   - 4 sitelink extensions (top-level, country guide pages)
 *   - 6 callout extensions
 *   - Negative keywords (campaign-level)
 *
 * NOTE: The page feed itself (blog-page-feed.csv) must be uploaded
 * separately under Tools → Business data → Page feed before linking it
 * to the campaign.
 */

const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, '..', 'reports', 'google-ads', 'dsa-blog-campaign.csv');

const CAMPAIGN  = 'DSA - Blog Makaleleri - Tümü';
const AD_GROUP  = 'Blog - Tüm Makaleler';
const DAILY_BUDGET = 200;
const FINAL_URL_DOMAIN = 'vgdanismanlik.com';

const SITELINKS = [
    { text: 'Almanya\'da Üniversite',   url: 'https://vgdanismanlik.com/almanyada-universite',   d1: 'İngilizce eğitim, düşük harç', d2: 'Ücretsiz danışmanlık alın' },
    { text: 'İtalya\'da Üniversite',    url: 'https://vgdanismanlik.com/italyada-universite',    d1: 'Bursa, Bocconi, Sapienza',     d2: 'Tüm bölümler ve harçlar' },
    { text: 'Çekya\'da Üniversite',     url: 'https://vgdanismanlik.com/cekyada-universite',     d1: 'Prag, Brno, ücretsiz eğitim',  d2: 'Avrupa\'nın kalbinde okuyun' },
    { text: 'İngiltere\'de Üniversite', url: 'https://vgdanismanlik.com/ingilterede-universite', d1: 'Russell Group, Oxbridge',      d2: 'Vize ve burs desteği dahil' },
    { text: 'Hollanda\'da Üniversite',  url: 'https://vgdanismanlik.com/hollandada-universite',  d1: 'TU Delft, Erasmus, UvA',       d2: 'İngilizce lisans seçenekleri' },
    { text: 'İspanya\'da Üniversite',   url: 'https://vgdanismanlik.com/ispanyada-universite',   d1: 'IE, ESADE, Carlos III',         d2: 'Madrid ve Barselona\'da okuyun' },
];

const CALLOUTS = [
    'Ücretsiz Danışmanlık',
    'Vize Desteği',
    'Burs Yardımı',
    '10+ Yıl Tecrübe',
    'WhatsApp Destek',
    'Başvuru Takibi',
];

const NEGATIVE_KEYWORDS = [
    'ücretsiz indir', 'pdf', 'doktora tezi', 'ödev', 'makale örneği',
    'özet', 'çıkmış sorular', 'wikipedia', 'iş ilanı', 'iş ara',
    'kpss', 'lys', 'yks', 'ales', 'youtube',
];

// Google Ads Editor bulk CSV columns (superset; empty cells are OK)
const COLUMNS = [
    'Campaign', 'Campaign Type', 'Campaign Subtype', 'Campaign Status',
    'Networks', 'Languages', 'Locations', 'Budget', 'Budget Type',
    'Bid Strategy Type', 'Bid Strategy Name',
    'Dynamic Ad Targets Source', 'Domain', 'Page Feeds',
    'Ad Group', 'Ad Group Status', 'Ad Group Type', 'Max CPC',
    'Ad type', 'Description Line 1', 'Description Line 2', 'Tracking Template',
    'Sitelink Text', 'Sitelink Final URL', 'Sitelink Description Line 1', 'Sitelink Description Line 2',
    'Callout Text',
    'Keyword', 'Match Type', 'Criterion Type',
];

function row(obj) {
    return COLUMNS.map(c => {
        const v = obj[c];
        if (v === undefined || v === null) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
    }).join(',');
}

const lines = [COLUMNS.join(',')];

// 1. Campaign settings
lines.push(row({
    Campaign: CAMPAIGN,
    'Campaign Type': 'Search',
    'Campaign Subtype': 'Standard',
    'Campaign Status': 'Enabled',
    Networks: 'Google search;Search partners',
    Languages: 'tr;en',
    Locations: 'Türkiye;Almanya;Kuzey Kıbrıs Türk Cumhuriyeti',
    Budget: DAILY_BUDGET,
    'Budget Type': 'Daily',
    'Bid Strategy Type': 'Maximize clicks',
    'Dynamic Ad Targets Source': 'Page feeds only',
    Domain: FINAL_URL_DOMAIN,
    'Page Feeds': 'Blog Articles - 306 URLs',
}));

// 2. Ad group (Dynamic)
lines.push(row({
    Campaign: CAMPAIGN,
    'Ad Group': AD_GROUP,
    'Ad Group Status': 'Enabled',
    'Ad Group Type': 'Dynamic',
    'Max CPC': '0.80',
}));

// 3. Dynamic Search Ad
lines.push(row({
    Campaign: CAMPAIGN,
    'Ad Group': AD_GROUP,
    'Ad type': 'Dynamic search ad',
    'Description Line 1': 'Avrupa\'nın en iyi üniversitelerinde lisans, yüksek lisans bölümleri. Detaylı rehber.',
    'Description Line 2': 'Ücretsiz danışmanlık, başvuru desteği, vize ve burs yardımı. WhatsApp ile hemen iletişim.',
}));

// 4. Sitelinks (campaign-level)
for (const sl of SITELINKS) {
    lines.push(row({
        Campaign: CAMPAIGN,
        'Sitelink Text': sl.text,
        'Sitelink Final URL': sl.url,
        'Sitelink Description Line 1': sl.d1,
        'Sitelink Description Line 2': sl.d2,
    }));
}

// 5. Callouts
for (const c of CALLOUTS) {
    lines.push(row({
        Campaign: CAMPAIGN,
        'Callout Text': c,
    }));
}

// 6. Negative keywords (campaign-level)
for (const kw of NEGATIVE_KEYWORDS) {
    lines.push(row({
        Campaign: CAMPAIGN,
        Keyword: kw,
        'Match Type': 'Phrase',
        'Criterion Type': 'Negative keyword',
    }));
}

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, lines.join('\n') + '\n', 'utf8');

console.log(`✓ ${lines.length - 1} satır → ${path.relative(process.cwd(), OUTPUT)}`);
console.log(`  Kampanya:    1`);
console.log(`  Ad group:    1 (Dynamic)`);
console.log(`  Reklam:      1 (DSA)`);
console.log(`  Sitelink:    ${SITELINKS.length}`);
console.log(`  Callout:     ${CALLOUTS.length}`);
console.log(`  Negatif KW:  ${NEGATIVE_KEYWORDS.length}`);
console.log(`  Günlük büt.: ${DAILY_BUDGET} TL`);

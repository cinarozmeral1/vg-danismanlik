/**
 * Export universities and departments from DB to report skeleton JSON.
 * Output: reports/data/rapor-kanada-skeleton.json
 * Run: node scripts/export-universities-for-report.js
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');

const COUNTRY_ORDER = [
  'Czech Republic', 'Italy', 'Hungary', 'Germany', 'UK',
  'Austria', 'Poland', 'Netherlands', 'Spain'
];

const COUNTRY_META = {
  'Czech Republic': {
    name_tr: 'Çek Cumhuriyeti',
    application_start: '',
    application_end: '',
    portal_link: '',
    exceptions: '',
    diploma_notes_canada: '',
    diploma_notes_turkish: ''
  },
  'Italy': {
    name_tr: 'İtalya',
    application_start: '',
    application_end: '',
    portal_link: 'https://www.universitaly.it',
    exceptions: 'TOLC/IMAT: cisiaonline.it',
    diploma_notes_canada: '',
    diploma_notes_turkish: ''
  },
  'Hungary': {
    name_tr: 'Macaristan',
    application_start: '',
    application_end: '',
    portal_link: '',
    exceptions: '',
    diploma_notes_canada: '',
    diploma_notes_turkish: ''
  },
  'Germany': {
    name_tr: 'Almanya',
    application_start: '',
    application_end: '',
    portal_link: 'https://www.uni-assist.de',
    exceptions: '',
    diploma_notes_canada: '',
    diploma_notes_turkish: ''
  },
  'UK': {
    name_tr: 'Birleşik Krallık',
    application_start: '',
    application_end: '15 Ocak (çoğu program); Oxford/Cambridge: 15 Ekim',
    portal_link: 'https://www.ucas.com',
    exceptions: 'Oxford ve Cambridge için başvuru bitişi 15 Ekim.',
    diploma_notes_canada: '',
    diploma_notes_turkish: ''
  },
  'Austria': {
    name_tr: 'Avusturya',
    application_start: '',
    application_end: '',
    portal_link: '',
    exceptions: '',
    diploma_notes_canada: '',
    diploma_notes_turkish: ''
  },
  'Poland': {
    name_tr: 'Polonya',
    application_start: '',
    application_end: '',
    portal_link: '',
    exceptions: '',
    diploma_notes_canada: '',
    diploma_notes_turkish: ''
  },
  'Netherlands': {
    name_tr: 'Hollanda',
    application_start: '',
    application_end: '',
    portal_link: 'https://www.studielink.nl',
    exceptions: '',
    diploma_notes_canada: 'Kanada lise diploması VWO denk (araştırma üniversitelerine doğrudan başvuru).',
    diploma_notes_turkish: 'Türk lise diploması HAVO denk; araştırma üniversitelerine doğrudan kabul edilmez.'
  },
  'Spain': {
    name_tr: 'İspanya',
    application_start: '',
    application_end: '',
    portal_link: '',
    exceptions: '',
    diploma_notes_canada: '',
    diploma_notes_turkish: ''
  }
};

/** Araştırma verisi: reports/data/arastirma-verileri.json (resmi portallardan doldurulur) */
function loadArastirmaVerileri(dataDir) {
  const p = path.join(dataDir, 'arastirma-verileri.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.warn('Araştırma verisi okunamadı:', e.message);
    return null;
  }
}

async function run() {
  const dataDir = path.join(__dirname, '..', 'reports', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const arastirma = loadArastirmaVerileri(dataDir);
  const ulkeArastirma = arastirma?.ulke || {};
  const universiteOzel = arastirma?.universite_ozel || {};

  const unisResult = await pool.query(`
    SELECT id, name, name_en, country, city, world_ranking,
           COALESCE(website_url, website) as website_url,
           application_deadline
    FROM universities
    WHERE is_active = true
    ORDER BY country, name
  `).catch(() => ({ rows: [] }));

  const deptsResult = await pool.query(`
    SELECT id, university_id, name_tr, name_en, price, currency
    FROM university_departments
    WHERE is_active = true
    ORDER BY university_id, sort_order NULLS LAST, name_tr
  `).catch(() => ({ rows: [] }));

  const deptsByUni = {};
  for (const d of deptsResult.rows) {
    if (!deptsByUni[d.university_id]) deptsByUni[d.university_id] = [];
    deptsByUni[d.university_id].push(d);
  }

  const byCountry = {};
  for (const u of unisResult.rows) {
    const country = u.country || 'Other';
    if (!byCountry[country]) {
      const meta = { ...COUNTRY_META[country] || {
        name_tr: country,
        application_start: '',
        application_end: '',
        portal_link: '',
        exceptions: '',
        diploma_notes_canada: '',
        diploma_notes_turkish: ''
      } };
      Object.assign(meta, ulkeArastirma[country] || {});
      byCountry[country] = { country, ...meta, universities: [] };
    }
    const norm = (s) => (s || '').replace(/\u2019/g, "'").trim();
    let ozelData = universiteOzel[u.name] || universiteOzel[u.name_en] || null;
    if (!ozelData && typeof universiteOzel === 'object') {
      const nName = norm(u.name);
      const nNameEn = norm(u.name_en);
      for (const key of Object.keys(universiteOzel)) {
        const nKey = norm(key);
        if (nKey && (nName?.includes(nKey) || nNameEn?.includes(nKey) || nKey.includes(nName) || nKey.includes(nNameEn))) {
          ozelData = universiteOzel[key];
          break;
        }
      }
    }
    const departments = (deptsByUni[u.id] || []).map(d => {
      const base = {
        id: d.id,
        name_tr: d.name_tr,
        name_en: d.name_en || d.name_tr,
        price: d.price,
        currency: d.currency || 'EUR',
        language: '',
        required_docs_exams: '',
        app_start: '',
        app_end: '',
        duration: '',
        notes: ''
      };
      if (ozelData) {
        if (ozelData.application_start) base.app_start = ozelData.application_start;
        if (ozelData.application_end) base.app_end = ozelData.application_end;
        if (ozelData.required_docs_exams) base.required_docs_exams = ozelData.required_docs_exams;
        if (ozelData.notes) base.notes = ozelData.notes;
        if (ozelData.annual_fee && !base.price) base.price = parseFloat(ozelData.annual_fee) || null;
      }
      return base;
    });
    byCountry[country].universities.push({
      id: u.id,
      name: u.name,
      name_en: u.name_en || u.name,
      city: u.city,
      world_ranking: u.world_ranking,
      application_portal_link: u.website_url || '',
      is_vg: true,
      is_new_recommendation: false,
      departments
    });
  }

  const ordered = [];
  for (const c of COUNTRY_ORDER) {
    if (byCountry[c]) ordered.push(byCountry[c]);
  }
  for (const c of Object.keys(byCountry).sort()) {
    if (!COUNTRY_ORDER.includes(c)) ordered.push(byCountry[c]);
  }

  const skeleton = {
    meta: {
      generated_at: new Date().toISOString(),
      diploma_type: 'canada',
      description: 'Kanada lise diploması raporu; araştırma verisi reports/data/arastirma-verileri.json ile doldurulur.',
      takvim_2025_2026: arastirma?.takvim_2025_2026 || [],
      linkler: arastirma?.linkler || []
    },
    countries: ordered
  };

  const outPath = path.join(dataDir, 'rapor-kanada-skeleton.json');
  fs.writeFileSync(outPath, JSON.stringify(skeleton, null, 2), 'utf8');
  console.log('Skeleton yazıldı:', outPath);

  // Add 2 new-recommendation placeholder universities per country for rapor-kanada.json
  const withNewRecs = JSON.parse(JSON.stringify(skeleton));
  withNewRecs.meta.description = 'Kanada lise diploması raporu; VG üniversiteleri + ülke başına yeni öneriler.';
  for (const c of withNewRecs.countries) {
    c.universities.push(
      {
        id: 'new-1-' + c.country,
        name: '[Yeni öneri 1 – ' + (COUNTRY_META[c.country]?.name_tr || c.country) + ']',
        name_en: 'New recommendation 1',
        city: '',
        world_ranking: null,
        application_portal_link: '',
        is_vg: false,
        is_new_recommendation: true,
        departments: [{ id: 'd1', name_tr: 'Bölüm (araştırma ile doldurulacak)', name_en: 'Program', price: null, currency: 'EUR', language: '', required_docs_exams: '', app_start: '', app_end: '', duration: '', notes: '' }]
      },
      {
        id: 'new-2-' + c.country,
        name: '[Yeni öneri 2 – ' + (COUNTRY_META[c.country]?.name_tr || c.country) + ']',
        name_en: 'New recommendation 2',
        city: '',
        world_ranking: null,
        application_portal_link: '',
        is_vg: false,
        is_new_recommendation: true,
        departments: [{ id: 'd2', name_tr: 'Bölüm (araştırma ile doldurulacak)', name_en: 'Program', price: null, currency: 'EUR', language: '', required_docs_exams: '', app_start: '', app_end: '', duration: '', notes: '' }]
      }
    );
  }

  const dataPath = path.join(dataDir, 'rapor-kanada.json');
  fs.writeFileSync(dataPath, JSON.stringify(withNewRecs, null, 2), 'utf8');
  console.log('Veri dosyası (yeni önerilerle) yazıldı:', dataPath);

  // Popüler bölümler only: tıp, diş, mühendislik, ekonomi/işletme, mimarlık, hukuk, psikoloji, vb.
  const POPULER_KEYWORDS = /tıp|medicine|diş|dentistry|mühendislik|engineering|bilgisayar|computer|software|yazılım|economics|ekonomi|business|işletme|mimarlık|architecture|law|hukuk|uluslararası ilişkiler|international relations|psychology|psikoloji|moleküler|molecular|biomedical|veterinary|veteriner/i;
  function isPopulerBolum(d) {
    const tr = (d.name_tr || '').toLowerCase();
    const en = (d.name_en || '').toLowerCase();
    return POPULER_KEYWORDS.test(tr) || POPULER_KEYWORDS.test(en);
  }
  const populerRapor = JSON.parse(JSON.stringify(skeleton));
  populerRapor.meta.description = 'Kanada lise diploması — sadece popüler bölümler (tıp, diş, mühendislik, işletme, mimarlık, hukuk, psikoloji vb.). Kısa rapor için.';
  populerRapor.meta.diploma_type = 'canada';
  populerRapor.meta.takvim_2025_2026 = skeleton.meta.takvim_2025_2026;
  populerRapor.meta.linkler = skeleton.meta.linkler;
  for (const c of populerRapor.countries) {
    c.universities = (c.universities || []).map(u => ({
      ...u,
      departments: (u.departments || []).filter(isPopulerBolum)
    })).filter(u => (u.departments || []).length > 0);
  }
  populerRapor.countries = populerRapor.countries.filter(c => (c.universities || []).length > 0);
  const populerPath = path.join(dataDir, 'rapor-populer-bolumler.json');
  fs.writeFileSync(populerPath, JSON.stringify(populerRapor, null, 2), 'utf8');
  console.log('Popüler bölümler raporu yazıldı:', populerPath);

  const populerDept = populerRapor.countries.reduce((s, c) => s + c.universities.reduce((t, u) => t + (u.departments || []).length, 0), 0);
  console.log('Ülke sayısı:', ordered.length);
  console.log('Toplam üniversite (skeleton):', ordered.reduce((s, c) => s + c.universities.length, 0));
  console.log('Toplam bölüm:', ordered.reduce((s, c) => s + c.universities.reduce((t, u) => t + u.departments.length, 0), 0));
  console.log('Popüler bölüm raporu: üniversite', populerRapor.countries.reduce((s, c) => s + c.universities.length, 0), ', bölüm', populerDept);
  await pool.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

/**
 * Build HTML report from rapor-kanada.json.
 * PDF-optimized: table-layout fixed, no min-width, word-wrap; detail row for long text.
 * Output: reports/rapor-kanada-diplomasi.html
 * Run: node scripts/build-report-html.js
 */

const path = require('path');
const fs = require('fs');

const DATA_PATH = path.join(__dirname, '..', 'reports', 'data', 'rapor-kanada.json');
const POPULER_DATA_PATH = path.join(__dirname, '..', 'reports', 'data', 'rapor-populer-bolumler.json');
const FALLBACK_PATH = path.join(__dirname, '..', 'reports', 'data', 'rapor-kanada-skeleton.json');
const OUT_PATH = path.join(__dirname, '..', 'reports', 'rapor-kanada-diplomasi.html');

const USE_POPULER = process.argv.includes('--populer');

const FLAGS = {
  'Czech Republic': '&#127464;&#127487;',
  'Italy': '&#127470;&#127481;',
  'Hungary': '&#127469;&#127482;',
  'Germany': '&#127465;&#127466;',
  'UK': '&#127468;&#127463;',
  'Austria': '&#127462;&#127481;',
  'Poland': '&#127477;&#127473;',
  'Netherlands': '&#127475;&#127473;',
  'Spain': '&#127466;&#127480;'
};

function loadData() {
  const pathToLoad = USE_POPULER && fs.existsSync(POPULER_DATA_PATH)
    ? POPULER_DATA_PATH
    : fs.existsSync(DATA_PATH)
      ? DATA_PATH
      : fs.existsSync(FALLBACK_PATH)
        ? FALLBACK_PATH
        : null;
  if (!pathToLoad) throw new Error('reports/data/rapor-kanada.json veya rapor-populer-bolumler.json bulunamadı.');
  return JSON.parse(fs.readFileSync(pathToLoad, 'utf8'));
}

function esc(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function summaryStats(data) {
  let totalUni = 0;
  let totalDept = 0;
  const countryCount = data.countries.length;
  for (const c of data.countries) {
    totalUni += c.universities.length;
    for (const u of c.universities) {
      totalDept += (u.departments || []).length;
    }
  }
  return { countryCount, totalUni, totalDept };
}

function buildExecutiveSummary(data) {
  const { countryCount, totalUni, totalDept } = summaryStats(data);
  const vgUni = data.countries.reduce((s, c) => s + c.universities.filter(u => u.is_vg).length, 0);
  const newUni = totalUni - vgUni;

  return `
  <section class="executive-summary">
    <h2>Yönetici Özeti</h2>
    <p>Bu rapor <strong>Kanada lise diploması</strong> olan öğrenciler için hazırlanmıştır. Sistemdeki tüm üniversiteler ve lisans bölümleri listelenmiştir; araştırma ile doldurulacak alanlar revizyonlarla güncellenir.</p>
    <ul>
      <li><strong>Ülke sayısı:</strong> ${countryCount}</li>
      <li><strong>Toplam üniversite:</strong> ${totalUni} (VG sisteminde: ${vgUni}, yeni öneri: ${newUni})</li>
      <li><strong>Toplam bölüm:</strong> ${totalDept}</li>
    </ul>
    <p><strong>Önemli istisnalar:</strong> Birleşik Krallık’ta Oxford ve Cambridge için başvuru bitişi 15 Ekim; diğer programlar için 15 Ocak. İtalya’da TOLC/IMAT kayıt ve tarihleri cisiaonline.it üzerinden. Hollanda’da Kanada diploması VWO denk (araştırma üniversitelerine doğrudan başvuru); Türk diploması HAVO denk (Evrak 2’de detay).</p>
    <p><strong>Raporun kullanımı:</strong> İçindekilerden ülkeye gidin; her üniversitenin başvuru portal linki başlıkta yer alır. Bölüm tablolarında gereken belgeler/sınavlar ve özel notlar detay satırında verilir.</p>
  </section>`;
}

function buildCountrySection(c) {
  const flag = FLAGS[c.country] || '';
  const portalHtml = c.portal_link ? `<a href="${esc(c.portal_link)}" target="_blank" rel="noopener">${esc(c.portal_link)}</a>` : '—';
  let html = `
  <section class="country-section" id="country-${esc(c.country).replace(/\s+/g, '-')}">
    <h2 class="country-title">${flag} ${esc(c.name_tr)}</h2>
    <div class="country-overview">
      <p><strong>Başvuru başlangıç:</strong> ${esc(c.application_start) || '—'}</p>
      <p><strong>Başvuru bitiş:</strong> ${esc(c.application_end) || '—'}</p>
      <p><strong>Portal:</strong> ${portalHtml}</p>
      ${c.exceptions ? `<p><strong>İstisnalar:</strong> ${esc(c.exceptions)}</p>` : ''}
      ${c.diploma_notes_canada ? `<p><strong>Kanada diploması:</strong> ${esc(c.diploma_notes_canada)}</p>` : ''}
    </div>`;

  for (const u of c.universities || []) {
    const portalLink = u.application_portal_link ? `<a href="${esc(u.application_portal_link)}" target="_blank" rel="noopener">Başvuru / resmi site</a>` : '';
    const tags = [];
    if (u.is_vg) tags.push('<span class="tag tag-vg">VG sisteminde</span>');
    if (u.is_new_recommendation) tags.push('<span class="tag tag-new">Yeni öneri</span>');

    html += `
    <div class="university-block">
      <h3 class="university-name">${esc(u.name)}${u.name_en && u.name_en !== u.name ? ' (' + esc(u.name_en) + ')' : ''}</h3>
      <div class="university-meta">${esc(u.city || '')}${u.world_ranking ? ' · Sıralama: ' + esc(u.world_ranking) : ''}</div>
      <div class="university-tags">${tags.join(' ')}</div>
      ${portalLink ? '<p class="university-link">' + portalLink + '</p>' : ''}
      <table class="program-table">
        <thead>
          <tr>
            <th>Bölüm</th>
            <th>Dil</th>
            <th>Ücret</th>
            <th>Başvuru Baş</th>
            <th>Başvuru Bit</th>
            <th>Süre</th>
          </tr>
        </thead>
        <tbody>`;

    for (const d of u.departments || []) {
      const fee = d.price != null ? (d.currency ? `${d.price} ${d.currency}` : String(d.price)) : '—';
      html += `
          <tr class="program-row">
            <td>${esc(d.name_tr)}${d.name_en ? ' (' + esc(d.name_en) + ')' : ''}</td>
            <td>${esc(d.language) || '—'}</td>
            <td>${esc(fee)}</td>
            <td>${esc(d.app_start) || '—'}</td>
            <td>${esc(d.app_end) || '—'}</td>
            <td>${esc(d.duration) || '—'}</td>
          </tr>`;
      if ((d.required_docs_exams || d.notes)) {
        html += `
          <tr class="detail-row">
            <td colspan="6">
              <strong>Gereken belgeler ve sınavlar:</strong> ${esc(d.required_docs_exams) || '—'}
              ${d.notes ? ' <strong>Özel notlar:</strong> ' + esc(d.notes) : ''}
            </td>
          </tr>`;
      }
    }

    html += `
        </tbody>
      </table>
    </div>`;
  }

  html += '</section>';
  return html;
}

function buildToc(data) {
  let items = [];
  for (const c of data.countries) {
    const id = 'country-' + c.country.replace(/\s+/g, '-');
    items.push(`<li><a href="#${id}">${FLAGS[c.country] || ''} ${esc(c.name_tr)}</a></li>`);
  }
  return `<nav class="toc no-print"><h2>İçindekiler</h2><ul>${items.join('')}</ul></nav>`;
}

function buildCountrySummaryTable(data) {
  let rows = '';
  for (const c of data.countries) {
    const portal = c.portal_link ? `<a href="${esc(c.portal_link)}" target="_blank" rel="noopener">Portal</a>` : '—';
    rows += `<tr><td>${FLAGS[c.country] || ''} ${esc(c.name_tr)}</td><td>${portal}</td><td>${esc(c.application_end || '—')}</td><td>${esc(c.exceptions || '—')}</td></tr>`;
  }
  return `<table class="summary-table"><thead><tr><th>Ülke</th><th>Portal</th><th>Kritik son tarih</th><th>İstisna</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function buildCalendarSection(data) {
  const takvim = (data.meta && data.meta.takvim_2025_2026) || [];
  if (takvim.length === 0) return '';
  const rows = takvim.map(t => `<tr><td>${esc(t.ay)}</td><td>${esc(t.olay)}</td></tr>`).join('');
  return `<section class="compact-section"><h2>Başvuru takvimi 2025–2026</h2><table class="calendar-table"><tbody>${rows}</tbody></table></section>`;
}

function buildLinkHub(data) {
  const linkler = (data.meta && data.meta.linkler) || [];
  if (linkler.length === 0) return '';
  const items = linkler.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.ad)}</a>`).join(' · ');
  return `<section class="compact-section"><h2>Merkezi portallar</h2><p class="link-hub">${items}</p></section>`;
}

function buildCompactCountrySection(c) {
  const flag = FLAGS[c.country] || '';
  let html = `
  <section class="country-section compact-country" id="country-${esc(c.country).replace(/\s+/g, '-')}">
    <h2 class="country-title">${flag} ${esc(c.name_tr)}</h2>
    <p class="country-meta"><strong>Portal:</strong> ${c.portal_link ? `<a href="${esc(c.portal_link)}" target="_blank" rel="noopener">${esc(c.portal_link)}</a>` : '—'} &nbsp;|&nbsp; <strong>Son tarih:</strong> ${esc(c.application_end) || '—'} ${c.adim_adim ? ' &nbsp;|&nbsp; <strong>Adım:</strong> ' + esc(c.adim_adim) : ''}</p>`;
  for (const u of c.universities || []) {
    html += `<div class="university-compact"><h3>${esc(u.name)}</h3>`;
    for (const d of u.departments || []) {
      const fee = d.price != null ? (d.currency ? `${d.price} ${d.currency}` : String(d.price)) : '—';
      html += `<div class="program-compact"><strong>${esc(d.name_tr)}</strong> — Ücret: ${esc(fee)} | Başvuru: ${esc(d.app_start) || '—'} – ${esc(d.app_end) || '—'}`;
      if (d.required_docs_exams || d.notes) html += ` <span class="detail">${esc((d.required_docs_exams || '') + (d.notes ? ' ' + d.notes : ''))}</span>`;
      html += `</div>`;
    }
    html += `</div>`;
  }
  html += '</section>';
  return html;
}

function buildCompactHtml(data) {
  const toc = buildToc(data);
  const summaryTable = buildCountrySummaryTable(data);
  const calendar = buildCalendarSection(data);
  const linkHub = buildLinkHub(data);
  const countrySections = data.countries.map(buildCompactCountrySection).join('\n');
  const { countryCount, totalUni, totalDept } = summaryStats(data);

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Akıllı Rapor — Popüler Bölümler (Kanada Diploması) | Venture Global</title>
  <style>
    :root { --vg-primary: #005A9E; --vg-primary-dark: #003d6b; --vg-light: #e8f4fc; --vg-border: #b8d4e8; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.35; color: #1a1a1a; margin: 0; padding: 10px; background: #f5f7fa; font-size: 0.85rem; }
    .header { background: linear-gradient(135deg, var(--vg-primary), var(--vg-primary-dark)); color: #fff; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; }
    .header h1 { margin: 0 0 0.2rem 0; font-size: 1.2rem; }
    .header p { margin: 0; font-size: 0.8rem; opacity: 0.95; }
    .toc { background: #fff; border: 1px solid var(--vg-border); border-radius: 8px; padding: 0.75rem; margin-bottom: 1rem; font-size: 0.8rem; }
    .toc h2 { margin: 0 0 0.4rem 0; font-size: 1rem; }
    .toc ul { list-style: none; padding: 0; margin: 0; columns: 2; }
    .toc li { padding: 0.2rem 0; break-inside: avoid; }
    .toc a { color: var(--vg-primary); text-decoration: none; }
    .compact-section { background: #fff; border: 1px solid var(--vg-border); border-radius: 8px; padding: 0.75rem; margin-bottom: 1rem; }
    .compact-section h2 { margin: 0 0 0.4rem 0; font-size: 1rem; color: var(--vg-primary-dark); }
    table.summary-table, table.calendar-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
    table.summary-table th, table.summary-table td, table.calendar-table th, table.calendar-table td { border: 1px solid var(--vg-border); padding: 0.3rem 0.4rem; text-align: left; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; }
    table.summary-table th, table.calendar-table th { background: var(--vg-primary); color: #fff; }
    .link-hub a { margin-right: 0.5rem; color: var(--vg-primary); }
    .country-section.compact-country { background: #fff; border: 1px solid var(--vg-border); border-radius: 8px; margin-bottom: 1rem; padding: 0.75rem; break-inside: avoid; }
    .country-section.compact-country .country-title { margin: 0 0 0.3rem 0; font-size: 1rem; background: var(--vg-light); padding: 0.4rem 0.5rem; border-radius: 4px; }
    .country-meta { margin: 0 0 0.5rem 0; font-size: 0.75rem; color: #444; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; }
    .university-compact { margin-bottom: 0.6rem; padding-left: 0.5rem; border-left: 3px solid var(--vg-border); display: block; overflow: visible; }
    .university-compact h3 { margin: 0 0 0.25rem 0; font-size: 0.95rem; }
    .program-compact { font-size: 0.8rem; margin-bottom: 0.2rem; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; }
    .program-compact .detail { color: #555; font-size: 0.75rem; word-wrap: break-word; overflow-wrap: break-word; white-space: normal; display: inline; }
    @media print {
      body { background: #fff; padding: 8px; font-size: 0.8rem; orphans: 2; widows: 2; }
      .no-print { display: none !important; }
      .header, footer { break-inside: avoid !important; page-break-inside: avoid !important; }
      .compact-section { break-inside: avoid !important; page-break-inside: avoid !important; }
      .country-section.compact-country { break-inside: auto; page-break-inside: auto; }
      .country-section.compact-country .country-title { break-after: avoid !important; page-break-after: avoid !important; }
      .university-compact { page-break-before: always !important; break-inside: avoid !important; page-break-inside: avoid !important; display: block !important; }
      .program-compact { break-inside: avoid !important; page-break-inside: avoid !important; }
      table.summary-table thead, table.calendar-table thead { display: table-header-group; }
      table.summary-table tbody tr, table.calendar-table tbody tr { break-inside: avoid !important; page-break-inside: avoid !important; }
    }
  </style>
</head>
<body>
  <header class="header">
    <h1>Akıllı Rapor — Popüler Bölümler (Tıp, Diş, Mühendislik, İşletme, Mimarlık, Hukuk, Psikoloji)</h1>
    <p>Kanada lise diploması · ${countryCount} ülke · ${totalUni} üniversite · ${totalDept} bölüm · Venture Global</p>
  </header>
  ${toc}
  <section class="compact-section">
    <h2>Ülke özeti</h2>
    ${summaryTable}
  </section>
  ${calendar}
  ${linkHub}
  <section class="compact-section">
    <h2>Diploma</h2>
    <p>Kanada lise: 12 yıl, çoğu ülkede doğrudan lisans başvurusu. Türk lise: Hollanda’da HAVO denk (araştırma üniversitesine doğrudan kabul yok); diğer ülkelerde 12 yıl kabul, bölüme göre sınav/denklik.</p>
  </section>
  <main>
  ${countrySections}
  </main>
  <footer style="margin-top: 0.75rem; padding: 0.5rem; text-align: center; color: #666; font-size: 0.75rem;">Venture Global · Resmi portallardan doğrulayın.</footer>
</body>
</html>`;
}

function buildFullHtml(data) {
  const toc = buildToc(data);
  const summary = buildExecutiveSummary(data);
  const countrySections = data.countries.map(buildCountrySection).join('\n');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Kanada Lise Diploması — Avrupa ve UK Lisans Programları Raporu | Venture Global</title>
  <style>
    :root { --vg-primary: #005A9E; --vg-primary-dark: #003d6b; --vg-light: #e8f4fc; --vg-border: #b8d4e8; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.4; color: #1a1a1a; margin: 0; padding: 12px; background: #f5f7fa; }
    .header { background: linear-gradient(135deg, var(--vg-primary), var(--vg-primary-dark)); color: #fff; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; }
    .header h1 { margin: 0 0 0.25rem 0; font-size: 1.4rem; }
    .header p { margin: 0; font-size: 0.9rem; opacity: 0.95; }
    .toc { background: #fff; border: 1px solid var(--vg-border); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; }
    .toc h2 { margin: 0 0 0.5rem 0; font-size: 1.1rem; color: var(--vg-primary-dark); }
    .toc ul { list-style: none; padding: 0; margin: 0; }
    .toc li { padding: 0.25rem 0; border-bottom: 1px solid #eee; }
    .toc a { color: var(--vg-primary); text-decoration: none; }
    .executive-summary { background: #fff; border: 1px solid var(--vg-border); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; }
    .executive-summary h2 { margin: 0 0 0.5rem 0; font-size: 1.15rem; color: var(--vg-primary-dark); }
    .executive-summary p, .executive-summary ul { margin: 0.35rem 0; font-size: 0.9rem; }
    .country-section { background: #fff; border: 1px solid var(--vg-border); border-radius: 8px; margin-bottom: 1.5rem; overflow: visible; break-inside: avoid; }
    .country-title { margin: 0; padding: 0.6rem 1rem; background: var(--vg-light); font-size: 1.1rem; color: var(--vg-primary-dark); border-bottom: 1px solid var(--vg-border); }
    .country-overview { padding: 0.75rem 1rem; background: #f8fbfd; font-size: 0.8rem; }
    .country-overview p { margin: 0.2rem 0; }
    .country-overview a { color: var(--vg-primary); }
    .university-block { padding: 0.75rem 1rem; border-bottom: 1px solid #eee; }
    .university-block:last-child { border-bottom: 0; }
    .university-name { margin: 0 0 0.2rem 0; font-size: 1rem; color: var(--vg-primary-dark); }
    .university-meta, .university-link { font-size: 0.8rem; color: #555; margin-bottom: 0.35rem; }
    .university-tags { margin-bottom: 0.35rem; }
    .tag { display: inline-block; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; margin-right: 0.25rem; }
    .tag-vg { background: #d4edda; color: #155724; }
    .tag-new { background: #fff3cd; color: #856404; }
    table.program-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; table-layout: fixed; margin-top: 0.35rem; }
    table.program-table th, table.program-table td { border: 1px solid var(--vg-border); padding: 0.35rem 0.4rem; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; }
    table.program-table th { background: var(--vg-primary); color: #fff; font-weight: 600; }
    table.program-table .detail-row td { font-size: 0.7rem; background: #f8fbfd; }
    @media print {
      body { background: #fff; padding: 8px; }
      .no-print { display: none !important; }
      .country-section { break-inside: avoid; page-break-inside: avoid; }
      .university-block { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header class="header">
    <h1>Kanada Lise Diploması — Avrupa ve Birleşik Krallık Lisans Programları</h1>
    <p>Danışmanlık operasyon raporu · Venture Global · Güncel: 2025</p>
  </header>
  ${toc}
  ${summary}
  <main>
  ${countrySections}
  </main>
  <footer style="margin-top: 1rem; padding: 0.75rem; text-align: center; color: #666; font-size: 0.8rem;">
    Bu rapor Venture Global tarafından hazırlanmıştır. Veriler revizyonla güncellenir; resmi portallardan doğrulayın.
  </footer>
</body>
</html>`;
}

function run() {
  const data = loadData();
  const html = USE_POPULER ? buildCompactHtml(data) : buildFullHtml(data);
  fs.writeFileSync(OUT_PATH, html, 'utf8');
  console.log('HTML yazıldı:', OUT_PATH, USE_POPULER ? '(kısa rapor — popüler bölümler)' : '');
  const { countryCount, totalUni, totalDept } = summaryStats(data);
  console.log('Ülke:', countryCount, 'Üniversite:', totalUni, 'Bölüm:', totalDept);
}

run();

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

const mdPath = path.join(__dirname, '../reports/TEKNIK_REHBER_RAPORU.md');
const outPath = path.join(__dirname, '../reports/TEKNIK_REHBER_RAPORU.pdf');

const markdown = fs.readFileSync(mdPath, 'utf8');
const body = marked.parse(markdown);

const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>VG Danışmanlık — Teknik Rehber Raporu</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 10.5pt;
    line-height: 1.65;
    color: #1a1a2e;
    background: #fff;
    padding: 0;
  }

  /* Cover page */
  .cover {
    width: 100%;
    min-height: 100vh;
    background: linear-gradient(135deg, #0f3460 0%, #16213e 60%, #0f3460 100%);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 60px 80px;
    page-break-after: always;
    position: relative;
  }
  .cover::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }
  .cover-badge {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    color: #a8c8f0;
    font-size: 9pt;
    font-weight: 600;
    letter-spacing: 3px;
    text-transform: uppercase;
    padding: 6px 18px;
    border-radius: 20px;
    margin-bottom: 40px;
  }
  .cover-logo {
    font-size: 42pt;
    font-weight: 800;
    color: #fff;
    letter-spacing: -1px;
    margin-bottom: 6px;
    position: relative;
  }
  .cover-logo span { color: #64b5f6; }
  .cover-subtitle {
    font-size: 14pt;
    color: rgba(255,255,255,0.7);
    margin-bottom: 60px;
    font-weight: 400;
  }
  .cover-title {
    font-size: 26pt;
    font-weight: 700;
    color: #fff;
    line-height: 1.25;
    margin-bottom: 20px;
    max-width: 600px;
  }
  .cover-desc {
    font-size: 11pt;
    color: rgba(255,255,255,0.6);
    max-width: 480px;
    line-height: 1.6;
    margin-bottom: 80px;
  }
  .cover-meta {
    display: flex;
    gap: 40px;
    align-items: center;
  }
  .cover-meta-item {
    text-align: center;
  }
  .cover-meta-label {
    font-size: 7.5pt;
    color: rgba(255,255,255,0.45);
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .cover-meta-value {
    font-size: 10pt;
    color: rgba(255,255,255,0.85);
    font-weight: 500;
  }
  .cover-divider {
    width: 60px;
    height: 3px;
    background: #64b5f6;
    border-radius: 2px;
    margin: 0 auto 60px;
  }

  /* Content */
  .content {
    padding: 36px 52px;
    max-width: 100%;
  }

  h1 {
    font-size: 22pt;
    font-weight: 800;
    color: #0f3460;
    margin: 48px 0 16px;
    padding-bottom: 10px;
    border-bottom: 3px solid #0f3460;
    page-break-after: avoid;
    line-height: 1.2;
  }
  h1:first-child { margin-top: 0; }

  h2 {
    font-size: 15pt;
    font-weight: 700;
    color: #16213e;
    margin: 36px 0 12px;
    padding-left: 14px;
    border-left: 4px solid #64b5f6;
    page-break-after: avoid;
  }

  h3 {
    font-size: 11.5pt;
    font-weight: 700;
    color: #0f3460;
    margin: 24px 0 10px;
    page-break-after: avoid;
  }

  h4 {
    font-size: 10.5pt;
    font-weight: 600;
    color: #334155;
    margin: 16px 0 8px;
  }

  p {
    margin-bottom: 10px;
    color: #374151;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0 20px;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }
  thead tr {
    background: #0f3460;
    color: #fff;
  }
  thead th {
    padding: 9px 12px;
    text-align: left;
    font-weight: 600;
    letter-spacing: 0.3px;
  }
  tbody tr:nth-child(even) { background: #f0f4f8; }
  tbody tr:nth-child(odd) { background: #fff; }
  tbody tr:hover { background: #e8f0fe; }
  td {
    padding: 7px 12px;
    color: #374151;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: top;
  }
  td:first-child { font-weight: 500; color: #1a1a2e; }

  /* Code blocks */
  pre {
    background: #0f172a;
    color: #e2e8f0;
    padding: 16px 20px;
    border-radius: 8px;
    margin: 14px 0 20px;
    overflow: hidden;
    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
    font-size: 8.5pt;
    line-height: 1.6;
    page-break-inside: avoid;
    border-left: 3px solid #64b5f6;
  }
  code {
    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
    font-size: 9pt;
    background: #eff6ff;
    color: #1d4ed8;
    padding: 2px 6px;
    border-radius: 4px;
  }
  pre code {
    background: none;
    color: inherit;
    padding: 0;
    font-size: 8.5pt;
    border-radius: 0;
  }

  /* Lists */
  ul, ol {
    margin: 8px 0 12px 22px;
    color: #374151;
  }
  li {
    margin-bottom: 4px;
    line-height: 1.55;
  }
  li > ul, li > ol { margin-top: 4px; margin-bottom: 4px; }

  /* Blockquote */
  blockquote {
    border-left: 4px solid #f59e0b;
    background: #fffbeb;
    padding: 12px 18px;
    margin: 14px 0;
    border-radius: 0 6px 6px 0;
    font-style: normal;
    page-break-inside: avoid;
  }
  blockquote p {
    margin: 0;
    color: #92400e;
    font-weight: 500;
  }

  /* Horizontal rule */
  hr {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 28px 0;
  }

  /* Strong */
  strong { color: #111827; font-weight: 700; }

  /* Links */
  a { color: #1d4ed8; text-decoration: none; }

  /* Page numbers via @page */
  @page {
    size: A4;
    margin: 18mm 15mm 18mm 15mm;
    @bottom-center {
      content: counter(page);
      font-size: 8pt;
      color: #9ca3af;
      font-family: 'Inter', sans-serif;
    }
  }
  @page :first { margin: 0; }

  /* Section breaks */
  .section-break { page-break-before: always; }
</style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover">
  <div class="cover-badge">Dahili Belge · Gizlilik: Kısıtlı</div>
  <div class="cover-logo">VG<span>.</span></div>
  <div class="cover-subtitle">Danışmanlık Platformu</div>
  <div class="cover-divider"></div>
  <div class="cover-title">Teknik Rehber Raporu</div>
  <div class="cover-desc">
    Yeniden yazım sürecine başlayacak yazılım ekibi için hazırlanan kapsamlı
    sistem dokümantasyonu. Tüm fonksiyonlar, entegrasyonlar, veri akışları
    ve e-posta tetikleyicileri dahildir.
  </div>
  <div class="cover-meta">
    <div class="cover-meta-item">
      <div class="cover-meta-label">Hazırlanma Tarihi</div>
      <div class="cover-meta-value">Nisan 2026</div>
    </div>
    <div class="cover-meta-item">
      <div class="cover-meta-label">Versiyon</div>
      <div class="cover-meta-value">1.0</div>
    </div>
    <div class="cover-meta-item">
      <div class="cover-meta-label">Bölüm Sayısı</div>
      <div class="cover-meta-value">20</div>
    </div>
    <div class="cover-meta-item">
      <div class="cover-meta-label">Durum</div>
      <div class="cover-meta-value">Tamamlandı</div>
    </div>
  </div>
</div>

<!-- MAIN CONTENT -->
<div class="content">
${body}
</div>

</body>
</html>`;

(async () => {
  console.log('Tarayıcı başlatılıyor...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });

  console.log('PDF oluşturuluyor...');
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="width:100%;font-size:7pt;font-family:'Helvetica Neue',sans-serif;color:#9ca3af;
                  padding:0 15mm;display:flex;justify-content:space-between;align-items:center;">
        <span>VG Danışmanlık — Teknik Rehber Raporu</span>
        <span>Dahili Belge</span>
      </div>`,
    footerTemplate: `
      <div style="width:100%;font-size:7pt;font-family:'Helvetica Neue',sans-serif;color:#9ca3af;
                  padding:0 15mm;display:flex;justify-content:space-between;align-items:center;">
        <span>© 2026 VG Danışmanlık. Tüm hakları saklıdır.</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' }
  });

  await browser.close();
  console.log('✓ PDF oluşturuldu:', outPath);
})();

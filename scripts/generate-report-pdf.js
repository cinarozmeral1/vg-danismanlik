/**
 * HTML raporunu PDF'e çevirir.
 * Kullanım: node scripts/generate-report-pdf.js
 * Gerekli: npm install puppeteer (bir kez)
 */

const path = require('path');
const fs = require('fs');

const htmlPath = path.join(__dirname, '..', 'reports', 'rapor-kanada-diplomasi.html');
const pdfPath = path.join(__dirname, '..', 'reports', 'rapor-kanada-diplomasi.pdf');

if (!fs.existsSync(htmlPath)) {
  console.error('HTML bulunamadı:', htmlPath);
  process.exit(1);
}

async function main() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.error('Puppeteer yüklü değil. Önce çalıştırın: npm install puppeteer');
    process.exit(1);
  }

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' });
  await page.emulateMediaType('print');
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    landscape: true,
    printBackground: true,
    margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' }
  });
  await browser.close();
  console.log('PDF oluşturuldu:', pdfPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

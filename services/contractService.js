/**
 * Contract PDF Generation Service
 * 
 * Strategy:
 *   1) PDFKit generates the contract TEXT ONLY (transparent background)
 *   2) pdf-lib embeds each text page ON TOP of the letterhead template
 *   Result: Contract looks like it was printed on branded letterhead paper
 */

const PDFDocument = require('pdfkit');
const { PDFDocument: PDFLibDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const FONT_PATHS = [
    path.join(__dirname, '..', 'public', 'fonts', 'DejaVuSans.ttf'),
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
];
const FONT_BOLD_PATHS = [
    path.join(__dirname, '..', 'public', 'fonts', 'DejaVuSans-Bold.ttf'),
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
];
const LETTERHEAD_PATH = path.join(__dirname, '..', 'public', 'templates', 'Venture Antetli_2026-3.pdf');

function findFont(paths) {
    for (const p of paths) { try { if (fs.existsSync(p)) return p; } catch (e) { } } return null;
}
function formatDate(d) {
    if (!d) return '__ / __ / ____';
    const x = new Date(d);
    return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
}
function formatCurrency(a, c = 'EUR') {
    if (!a && a !== 0) return '_________';
    return `${parseFloat(a).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;
}
function numberToTurkishText(n) {
    if (!n && n !== 0) return '_________';
    n = Math.floor(parseFloat(n));
    const o = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz'];
    const t = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan'];
    if (n === 0) return 'Sıfır';
    if (n >= 1000) { const k = Math.floor(n / 1000); let r = (k === 1 ? '' : numberToTurkishText(k)) + 'Bin'; if (n % 1000 > 0) r += numberToTurkishText(n % 1000); return r; }
    let r = ''; const h = Math.floor(n / 100), te = Math.floor((n % 100) / 10), on = n % 10;
    if (h > 0) r += (h === 1 ? '' : o[h]) + 'Yüz'; if (te > 0) r += t[te]; if (on > 0) r += o[on]; return r || 'Sıfır';
}
function generateContractNumber(userId) {
    return `VG-${new Date().getFullYear()}-${String(userId).padStart(4, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: Generate text-only PDF (no background, just contract text)
// ─────────────────────────────────────────────────────────────────────────────
function generateTextOnlyPdf(data) {
    return new Promise((resolve, reject) => {
        try {
            const { user, applications, services } = data;
            const fp = findFont(FONT_PATHS), fb = findFont(FONT_BOLD_PATHS);

            // Margins leave room for letterhead header (~80pt top) and footer (~55pt bottom)
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 85, bottom: 60, left: 65, right: 65 },
                bufferPages: true
            });

            if (fp) { doc.registerFont('R', fp); doc.registerFont('B', fb || fp); }
            else { doc.registerFont('R', 'Helvetica'); doc.registerFont('B', 'Helvetica-Bold'); }

            const chunks = [];
            doc.on('data', c => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', e => reject(e));

            // ── Data ──
            const today = formatDate(new Date());
            const sn = `${user.first_name || ''} ${user.last_name || ''}`.trim() || '_________________________';
            const tc = user.tc_number || '_________________________';
            const bd = formatDate(user.birth_date);
            const pp = user.passport_number || '_________________________';
            const app = applications && applications.length > 0 ? applications[0] : null;
            const country = (app && app.country) || user.desired_country || '_________________________';
            const program = (app && app.program_name) || '_________________________';
            const bl = '_________________________';

            // Payment: each service = one installment, total = sum of all
            let svcs = (services || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            const s1 = svcs[0] || null, s2 = svcs[1] || null;
            const cur = (s1 && s1.currency) || 'EUR';
            const total = svcs.reduce((s, x) => s + parseFloat(x.amount || 0), 0);
            const a1 = s1 ? parseFloat(s1.amount) : null, a2 = s2 ? parseFloat(s2.amount) : null;
            const paid1 = s1 ? s1.is_paid : false, paid2 = s2 ? s2.is_paid : false;
            const pd1 = s1 && s1.payment_date ? formatDate(s1.payment_date) : '__ / __ / ____';
            const pd2 = s2 && s2.payment_date ? formatDate(s2.payment_date) : '__ / __ / ____';

            const PW = doc.page.width - 130; // usable text width
            const ML = 65;
            const RX = doc.page.width - 65;
            const CLR = { dk: '#1a365d', tx: '#222', mu: '#777' };

            // Font sizes
            const SZ = { title: 12, sec: 9.5, body: 8.5, field: 8, label: 8, small: 7, tiny: 6.5 };

            // ── Helpers ──
            function section(title) {
                doc.moveDown(0.4);
                doc.font('B').fontSize(SZ.sec).fillColor(CLR.dk).text(title, ML);
                const y = doc.y + 1;
                doc.moveTo(ML, y).lineTo(RX, y).strokeColor(CLR.dk).lineWidth(0.5).stroke();
                doc.y = y + 4;
            }

            function field(label, value) {
                doc.font('B').fontSize(SZ.field).fillColor('#444').text(label, ML + 8, doc.y, { continued: true, width: PW - 16 });
                doc.font('R').fontSize(SZ.field).fillColor(CLR.tx).text(' ' + value, { width: PW - 16 });
            }

            function para(text, indent) {
                const x = ML + (indent || 0);
                doc.font('R').fontSize(SZ.body).fillColor(CLR.tx).text(text, x, doc.y, { width: PW - (indent || 0), lineGap: 1.5 });
            }

            function item(num, text) {
                doc.font('R').fontSize(SZ.body).fillColor(CLR.tx).text(`${num} ${text}`, ML + 8, doc.y, { width: PW - 16, lineGap: 1.2 });
            }

            function bullet(text, indent) {
                doc.font('R').fontSize(SZ.body).fillColor(CLR.tx).text(`• ${text}`, ML + (indent || 16), doc.y, { width: PW - (indent || 16) - 8, lineGap: 1 });
            }

            function checkPage(needed) {
                if (doc.y + needed > doc.page.height - doc.page.margins.bottom - 10) {
                    doc.addPage();
                    doc.y = 85;
                }
            }

            // ══════════════════════════════════════════════════════════════════
            // CONTRACT CONTENT
            // ══════════════════════════════════════════════════════════════════
            doc.y = 85;

            // Title
            doc.font('B').fontSize(SZ.title).fillColor(CLR.dk)
                .text('YURT DIŞI EĞİTİM DANIŞMANLIK SÖZLEŞMESİ', { align: 'center' });
            doc.moveDown(0.2);

            // Contract info line
            doc.font('R').fontSize(SZ.tiny).fillColor(CLR.mu);
            const infoY = doc.y;
            doc.text(`Sözleşme No: ${generateContractNumber(user.id)}`, ML, infoY);
            doc.text(`Düzenleme Tarihi: ${today}`, ML, infoY, { width: PW, align: 'right' });
            doc.moveDown(0.15);
            doc.moveTo(ML, doc.y).lineTo(RX, doc.y).strokeColor('#ccc').lineWidth(0.3).stroke();

            // ── TARAFLAR ──
            section('TARAFLAR');

            doc.font('B').fontSize(SZ.body).fillColor(CLR.dk).text('1. DANIŞMAN', ML + 4);
            doc.moveDown(0.1);
            field('Unvan:', 'Venture Global Yurt Dışı Eğitim Danışmanlık');
            field('Adres:', 'İstanbul, Türkiye');
            field('Telefon:', '+90 539 927 30 08');
            field('E-posta:', 'info@vgdanismanlik.com');
            field('Web:', 'www.vgdanismanlik.com');
            field('TL IBAN:', 'TR56 0006 4000 0011 2120 9085 60');
            field('EUR IBAN:', 'TR56 0006 4000 0011 2120 9085 60');
            doc.font('R').fontSize(SZ.small).fillColor(CLR.mu).text('(Bundan böyle "DANIŞMAN" olarak anılacaktır.)', ML + 8);
            doc.moveDown(0.25);

            doc.font('B').fontSize(SZ.body).fillColor(CLR.dk).text('2. VELİ / YASAL TEMSİLCİ', ML + 4);
            doc.moveDown(0.1);
            field('Adı Soyadı:', bl);
            field('T.C. Kimlik No:', bl);
            field('Adres:', bl);
            field('Telefon:', bl);
            field('E-posta:', bl);
            doc.font('R').fontSize(SZ.small).fillColor(CLR.mu).text('(Bundan böyle "VELİ" olarak anılacaktır.)', ML + 8);
            doc.moveDown(0.25);

            doc.font('B').fontSize(SZ.body).fillColor(CLR.dk).text('3. ÖĞRENCİ (Hizmetten Faydalanacak Kişi)', ML + 4);
            doc.moveDown(0.1);
            field('Adı Soyadı:', sn);
            field('T.C. Kimlik No:', tc);
            field('Doğum Tarihi:', bd);
            field('Pasaport No:', pp);
            doc.font('R').fontSize(SZ.small).fillColor(CLR.mu).text('(Bundan böyle "ÖĞRENCİ" olarak anılacaktır.)', ML + 8);

            // ── MADDE 1 ──
            checkPage(70);
            section('MADDE 1 – SÖZLEŞMENİN KONUSU');
            para('İşbu sözleşme, DANIŞMAN\'ın ÖĞRENCİ\'ye yurt dışında yükseköğretim eğitimi alabilmesi için danışmanlık hizmeti vermesine ilişkin tarafların karşılıklı hak ve yükümlülüklerini düzenlemektedir.');
            doc.moveDown(0.15);
            field('Hedef Ülke/Ülkeler:', country);
            field('Hedef Program:', program);
            const yr = new Date().getFullYear();
            field('Hedef Dönem:', `${yr}-${yr + 1}`);

            // ── MADDE 2 ──
            checkPage(80);
            section('MADDE 2 – DANIŞMANLIK HİZMETLERİ (DAHİL OLAN)');
            para('DANIŞMAN, işbu sözleşme kapsamında aşağıdaki hizmetleri sunmayı taahhüt eder:');
            doc.moveDown(0.15);

            const svcList = [
                ['2.1. Öğrenci Profili ve İhtiyaç Analizi', ['Öğrencinin akademik geçmişi, ilgi alanları ve hedeflerine yönelik ayrıntılı analiz ve değerlendirme']],
                ['2.2. Üniversite Seçimi ve Yönlendirme', ['Öğrencinin profiline uygun üniversite ve programların belirlenmesi', 'Başvuru stratejisinin oluşturulması']],
                ['2.3. Başvuru Dosyası Hazırlama', ['Gerekli belgelerin listelenmesi', 'Motivasyon mektubu yazımında rehberlik', 'Özgeçmiş (CV) hazırlanmasında destek', 'Başvuru formlarının doldurulmasında yardım']],
                ['2.4. Başvuru Takibi', ['Üniversite başvurularının yapılması ve takibi', 'Kabul mektubunun teslim sürecinin takibi']],
                ['2.5. Vize Danışmanlığı', ['Vize başvurusu için gerekli belgelerin hazırlanması', 'Başvuru formunun doldurulmasında yardım', 'Vize randevusu alınmasında destek', 'Başvuru sürecinin takibi']],
                ['2.6. Konaklama Düzenlemeleri', ['Öğrenci yurdu veya özel konaklama seçeneklerinin araştırılması', 'Konaklama rezervasyonunda yardım']],
                ['2.7. Varış Öncesi Hazırlık', ['Gidiş öncesi bilgilendirme ve oryantasyon', 'Gerekli eşya ve belge listesi hazırlanması']],
                ['2.8. Varış Sonrası Destek (Çek Cumhuriyeti için)', ['Prag Havalimanı\'nda karşılama ve transfer', 'SIM kart temini konusunda yardım', 'Banka hesabı açılmasında destek', 'İlk günlerde şehir oryantasyonu']],
                ['2.9. Sürekli Destek', ['Eğitim süreci boyunca 7/24 iletişim hattı', 'Acil durumlarda destek']]
            ];

            for (const [title, items] of svcList) {
                checkPage(20 + items.length * 12);
                doc.font('B').fontSize(SZ.body).fillColor(CLR.dk).text(title, ML + 8, doc.y, { width: PW - 16 });
                for (const it of items) { bullet(it, 20); }
                doc.moveDown(0.1);
            }

            // ── MADDE 3 ──
            checkPage(90);
            section('MADDE 3 – DAHİL OLMAYAN HİZMETLER VE MASRAFLAR');
            para('Aşağıdaki masraflar işbu sözleşme kapsamı dışındadır ve VELİ/ÖĞRENCİ tarafından ayrıca karşılanacaktır:');
            doc.moveDown(0.1);
            const excl = [
                '3.1. Üniversite harç, kayıt ve eğitim ücretleri',
                '3.2. Konaklama (yurt, apartman vb.) ücretleri',
                '3.3. Uçak bileti ve seyahat masrafları',
                '3.4. Vize başvuru harçları ve konsolosluk ücretleri',
                '3.5. Sağlık sigortası primleri',
                '3.6. Apostil, noter ve tercüme masrafları',
                '3.7. Dil sınavı (IELTS, TOEFL vb.) ücretleri',
                '3.8. Günlük yaşam giderleri',
                '3.9. Türkiye dışında havalimanı transferi (Çek Cumhuriyeti Prag hariç)'
            ];
            for (const e of excl) { item('', e); }

            // ── MADDE 4 ──
            checkPage(100);
            section('MADDE 4 – DANIŞMANLIK ÜCRETİ VE ÖDEME KOŞULLARI');

            const totalStr = total > 0 ? formatCurrency(total, cur) : '_________ EUR';
            const totalTxt = total > 0 ? numberToTurkishText(total) : '_________';
            const inst1 = a1 ? formatCurrency(a1, cur) : '_________ EUR';
            const inst2 = a2 ? formatCurrency(a2, cur) : '_________ EUR';

            doc.font('B').fontSize(SZ.body).fillColor(CLR.tx)
                .text(`4.1. Toplam Danışmanlık Ücreti: ${totalStr}`, ML + 8, doc.y, { width: PW - 16 });
            doc.font('R').fontSize(SZ.body)
                .text(`       (Yazıyla: ${totalTxt} Euro)`, ML + 8, doc.y, { width: PW - 16 });
            doc.moveDown(0.2);

            doc.font('B').fontSize(SZ.body).text('4.2. Ödeme Planı:', ML + 8);
            doc.moveDown(0.1);

            doc.font('B').fontSize(SZ.body)
                .text(`a) BİRİNCİ TAKSİT (Kabul Öncesi Danışmanlık Ücreti): ${inst1}`, ML + 16, doc.y, { width: PW - 32 });
            doc.font('R').fontSize(SZ.body)
                .text('İşbu sözleşmenin imzalanması ile birlikte peşin olarak ödenir. Bu ödeme, danışmanlık hizmetinin başlangıç bedeli olup, hizmetin fiilen başladığını gösterir.', ML + 16, doc.y, { width: PW - 32, lineGap: 1 });
            doc.moveDown(0.15);

            doc.font('B').fontSize(SZ.body)
                .text(`b) İKİNCİ TAKSİT (Kabul Sonrası Danışmanlık Ücreti): ${inst2}`, ML + 16, doc.y, { width: PW - 32 });
            doc.font('R').fontSize(SZ.body)
                .text('Öğrencinin hedef üniversitelerden birine kabul alması halinde, kabul mektubunun tesliminden itibaren 7 (yedi) iş günü içinde ödenir.', ML + 16, doc.y, { width: PW - 32, lineGap: 1 });
            doc.moveDown(0.2);

            doc.font('B').fontSize(SZ.body).text('4.3. Ödeme Yöntemi:', ML + 8);
            para('Ödemeler, yukarıda belirtilen IBAN numaralarına havale/EFT yoluyla veya nakit olarak yapılabilir. Havale açıklamasına ÖĞRENCİ\'nin adı soyadı yazılmalıdır.', 16);
            doc.moveDown(0.15);

            doc.font('B').fontSize(SZ.body).text('4.4. Döviz Kuru:', ML + 8);
            para('EUR cinsinden belirlenen ücretler, ödeme günündeki T.C. Merkez Bankası EUR efektif satış kuru üzerinden TL\'ye çevrilebilir.', 16);

            // ── MADDE 5 ──
            checkPage(80);
            section('MADDE 5 – İADE POLİTİKASI');

            doc.font('B').fontSize(SZ.body).text('5.1. Birinci Taksit İadesi:', ML + 8);
            para('Birinci taksit, sözleşmenin imzalanması ve hizmetin başlaması ile birlikte İADE EDİLMEZ niteliğindedir. VELİ veya ÖĞRENCİ\'nin herhangi bir sebeple danışmanlık hizmetinden vazgeçmesi halinde, bu tutar verilen hizmetin karşılığı olarak DANIŞMAN\'da kalacaktır.', 8);
            doc.moveDown(0.15);

            doc.font('B').fontSize(SZ.body).text('5.2. İkinci Taksit:', ML + 8);
            para('a) ÖĞRENCİ, başvurduğu üniversitelerin hiçbirinden kabul alamaması durumunda ikinci taksit talep edilmez.', 16);
            para('b) ÖĞRENCİ kabul aldığı halde kendi isteğiyle eğitimden vazgeçerse, ikinci taksit tam olarak ödenir.', 16);
            doc.moveDown(0.15);

            doc.font('B').fontSize(SZ.body).text('5.3. Mücbir Sebepler:', ML + 8);
            para('Savaş, doğal afet, pandemi gibi mücbir sebeplerden kaynaklanan aksaklıklarda taraflar karşılıklı mutabakat ile çözüm arayacaktır.', 8);

            // ── MADDE 6 ──
            checkPage(80);
            section('MADDE 6 – VİZE REDDİ VE SORUMLULUK SINIRI');
            item('6.1.', 'DANIŞMAN, vize başvuru sürecinde rehberlik ve destek sağlamakla yükümlüdür. Ancak vize başvurusunun kabul veya reddi tamamen ilgili ülkenin konsolosluk/büyükelçiliğinin yetkisindedir.');
            item('6.2.', 'Vize reddi halinde DANIŞMAN\'ın herhangi bir sorumluluğu bulunmamaktadır. Vize reddi nedeniyle birinci taksit iadesi yapılmaz.');
            item('6.3.', 'Vize reddi durumunda, VELİ/ÖĞRENCİ\'nin talebi halinde DANIŞMAN, ilave ücret talep etmeksizin yeniden başvuru sürecinde destek sağlayacaktır (sadece danışmanlık hizmeti – harç ve masraflar hariç).');
            item('6.4.', 'DANIŞMAN, üniversite başvurularının kabul garantisi vermemektedir. Kabul kararı tamamen üniversitelerin yetkisindedir.');

            // ── MADDE 7 ──
            checkPage(110);
            section('MADDE 7 – TARAFLARIN YÜKÜMLÜLÜKLERİ');

            doc.font('B').fontSize(SZ.body).text('7.1. DANIŞMAN\'ın Yükümlülükleri:', ML + 8);
            const dYuk = [
                'Sözleşme kapsamındaki hizmetleri profesyonel standartlarda ve özenle yerine getirmek',
                'ÖĞRENCİ\'yi başvuru süreçleri hakkında doğru ve güncel bilgilendirmek',
                'Başvuru ve vize süreçlerini aktif olarak takip etmek',
                'Kişisel verileri gizli tutmak ve üçüncü şahıslarla paylaşmamak',
                'İletişim taleplerini makul sürede yanıtlamak'
            ];
            const abc = ['a', 'b', 'c', 'd', 'e', 'f'];
            for (let i = 0; i < dYuk.length; i++) {
                doc.font('R').fontSize(SZ.body).fillColor(CLR.tx)
                    .text(`${abc[i]}) ${dYuk[i]}`, ML + 16, doc.y, { width: PW - 32, lineGap: 1 });
            }
            doc.moveDown(0.2);

            checkPage(80);
            doc.font('B').fontSize(SZ.body).text('7.2. VELİ ve ÖĞRENCİ\'nin Yükümlülükleri:', ML + 8);
            const vYuk = [
                'DANIŞMAN\'a doğru, eksiksiz ve güncel bilgi vermek',
                'İstenen belgeleri zamanında ve eksiksiz teslim etmek',
                'Ödeme yükümlülüklerini sözleşmede belirtilen sürelerde yerine getirmek',
                'DANIŞMAN\'ın talep ettiği randevu ve toplantılara katılmak',
                'Başvuru süreçleriyle ilgili e-posta ve mesajları düzenli kontrol etmek',
                'DANIŞMAN\'dan bağımsız olarak üniversite veya konsolosluklarla iletişime geçmeden önce DANIŞMAN\'ı bilgilendirmek'
            ];
            for (let i = 0; i < vYuk.length; i++) {
                doc.font('R').fontSize(SZ.body).fillColor(CLR.tx)
                    .text(`${abc[i]}) ${vYuk[i]}`, ML + 16, doc.y, { width: PW - 32, lineGap: 1 });
            }
            doc.moveDown(0.1);
            item('7.3.', 'Yanlış veya eksik bilgi verilmesi nedeniyle doğacak tüm sorumluluk VELİ ve ÖĞRENCİ\'ye aittir.');

            // ── MADDE 8 ──
            checkPage(70);
            section('MADDE 8 – GİZLİLİK VE KVKK');
            item('8.1.', 'DANIŞMAN, işbu sözleşme kapsamında edindiği tüm kişisel bilgileri 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") hükümlerine uygun olarak işleyeceğini ve koruyacağını taahhüt eder.');
            item('8.2.', 'Kişisel veriler yalnızca aşağıdaki amaçlarla kullanılacaktır:');
            bullet('Üniversite başvurularının yapılması', 24);
            bullet('Vize başvuru işlemlerinin yürütülmesi', 24);
            bullet('Konaklama düzenlemelerinin sağlanması', 24);
            bullet('İletişim ve bilgilendirme', 24);
            item('8.3.', 'VELİ ve ÖĞRENCİ, kişisel verilerinin yukarıda belirtilen amaçlarla yurt dışındaki üniversiteler, konsolosluklar ve konaklama sağlayıcıları ile paylaşılmasına açıkça onay vermektedir.');
            item('8.4.', 'Taraflar, sözleşme şartlarını ve ücret bilgilerini üçüncü şahıslarla paylaşmamayı kabul eder.');

            // ── MADDE 9 ──
            checkPage(50);
            section('MADDE 9 – SÖZLEŞMENİN SÜRESİ VE FESHİ');
            item('9.1.', 'İşbu sözleşme, imza tarihinden itibaren yürürlüğe girer ve ÖĞRENCİ\'nin yurt dışında eğitime başlaması veya başvuru sürecinin sonuçlanması ile sona erer.');
            item('9.2.', 'Taraflardan biri, diğer tarafın sözleşme yükümlülüklerini ağır şekilde ihlal etmesi halinde yazılı bildirimle sözleşmeyi feshedebilir.');
            item('9.3.', 'Fesih halinde, Madde 5\'teki iade politikası hükümleri uygulanır.');

            // ── MADDE 10 ──
            checkPage(50);
            section('MADDE 10 – UYUŞMAZLIK VE YETKİLİ MAHKEME');
            item('10.1.', 'İşbu sözleşmeden doğabilecek uyuşmazlıklarda öncelikle taraflar karşılıklı görüşme yoluyla çözüm arayacaktır.');
            item('10.2.', 'Uzlaşma sağlanamaması halinde İstanbul Mahkemeleri ve İcra Daireleri yetkili olacaktır.');
            item('10.3.', 'İşbu sözleşme Türkiye Cumhuriyeti hukukuna tabidir.');

            // ── MADDE 11 ──
            checkPage(50);
            section('MADDE 11 – DİĞER HÜKÜMLER');
            item('11.1.', 'İşbu sözleşme 11 (on bir) maddeden oluşmakta olup, taraflarca okunmuş, anlaşılmış ve kabul edilmiştir.');
            item('11.2.', 'Sözleşmede yapılacak değişiklikler ancak yazılı olarak ve her iki tarafın imzasıyla geçerlilik kazanır.');
            item('11.3.', 'Sözleşmenin herhangi bir maddesinin geçersiz sayılması, diğer maddelerin geçerliliğini etkilemez.');
            item('11.4.', 'İşbu sözleşme 2 (iki) nüsha olarak düzenlenmiş olup, birer nüsha taraflarda kalacaktır.');

            // ── İMZALAR ──
            checkPage(160);
            section('İMZALAR');
            para('İşbu sözleşme, aşağıda belirtilen tarihte taraflarca imzalanarak yürürlüğe girmiştir.');
            doc.moveDown(0.5);

            const colW = (PW - 20) / 2;
            const lx = ML, rx = ML + colW + 20;
            let sy = doc.y;

            doc.font('B').fontSize(SZ.body).fillColor(CLR.dk);
            doc.text('DANIŞMAN', lx, sy, { width: colW });
            doc.text('VELİ / YASAL TEMSİLCİ', rx, sy, { width: colW });
            sy += 12;
            doc.moveTo(lx, sy).lineTo(lx + colW - 8, sy).strokeColor(CLR.dk).lineWidth(0.4).stroke();
            doc.moveTo(rx, sy).lineTo(rx + colW - 8, sy).strokeColor(CLR.dk).lineWidth(0.4).stroke();
            sy += 4;
            doc.font('R').fontSize(SZ.body).fillColor(CLR.tx);
            doc.text('Venture Global', lx, sy, { width: colW });
            doc.text('Yurt Dışı Eğitim Danışmanlık', lx, doc.y, { width: colW });
            doc.text('Adı Soyadı: ' + bl, rx, sy, { width: colW });
            doc.text('T.C. Kimlik No: ' + bl, rx, doc.y, { width: colW });
            sy = Math.max(doc.y, sy + 24) + 8;
            doc.text('İmza: ___________________', lx, sy);
            doc.text('İmza: ___________________', rx, sy);
            sy += 16;
            doc.text('Tarih: ' + today, lx, sy);
            doc.text('Tarih: ' + today, rx, sy);

            doc.y = sy + 20;
            doc.moveTo(ML, doc.y).lineTo(RX, doc.y).strokeColor('#ccc').lineWidth(0.3).stroke();
            doc.moveDown(0.3);

            doc.font('B').fontSize(SZ.body).fillColor(CLR.dk).text('ÖĞRENCİ', lx);
            let ssy = doc.y;
            doc.moveTo(lx, ssy).lineTo(lx + colW - 8, ssy).strokeColor(CLR.dk).lineWidth(0.4).stroke();
            doc.y = ssy + 4;
            doc.font('R').fontSize(SZ.body).fillColor(CLR.tx);
            doc.text('Adı Soyadı: ' + sn);
            doc.text('T.C. Kimlik No: ' + tc);
            doc.text('Pasaport No: ' + pp);
            doc.moveDown(0.2);
            doc.text('İmza: ___________________');
            doc.text('Tarih: ' + today);

            // ── EK-1: ÖDEME MAKBUZU ──
            checkPage(80);
            doc.moveDown(0.4);
            section('EK-1: ÖDEME MAKBUZU');
            doc.moveDown(0.15);

            doc.font('R').fontSize(SZ.body).fillColor(CLR.tx);
            doc.text(`${paid1 ? '☑' : '☐'} 1. Taksit Ödendi    Tarih: ${pd1}    Tutar: ${inst1}`);
            doc.text('   Ödeme Şekli: ☐ Havale/EFT   ☐ Nakit       Dekont/Makbuz No: _____________________');
            doc.moveDown(0.25);
            doc.text(`${paid2 ? '☑' : '☐'} 2. Taksit Ödendi    Tarih: ${pd2}    Tutar: ${inst2}`);
            doc.text('   Ödeme Şekli: ☐ Havale/EFT   ☐ Nakit       Dekont/Makbuz No: _____________________');

            doc.moveDown(0.5);
            doc.moveTo(ML, doc.y).lineTo(RX, doc.y).strokeColor(CLR.dk).lineWidth(0.4).stroke();
            doc.moveDown(0.2);
            doc.font('R').fontSize(SZ.small).fillColor(CLR.mu)
                .text(`Bu sözleşme ${today} tarihinde İstanbul'da düzenlenmiştir.`, { align: 'center' });

            doc.end();
        } catch (e) { reject(e); }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Merge text pages onto letterhead template
// ─────────────────────────────────────────────────────────────────────────────
async function mergeWithLetterhead(textPdfBytes) {
    const letterheadBytes = fs.readFileSync(LETTERHEAD_PATH);
    const textDoc = await PDFLibDocument.load(textPdfBytes);
    const letterheadDoc = await PDFLibDocument.load(letterheadBytes);
    const finalDoc = await PDFLibDocument.create();

    const textPageCount = textDoc.getPageCount();
    const lhPageCount = letterheadDoc.getPageCount();

    for (let i = 0; i < textPageCount; i++) {
        const lhIdx = Math.min(i, lhPageCount - 1);

        // Copy letterhead page as background
        const [copiedLH] = await finalDoc.copyPages(letterheadDoc, [lhIdx]);
        finalDoc.addPage(copiedLH);

        // Embed text page and draw on top
        const embeddedText = await finalDoc.embedPage(textDoc.getPage(i));
        const page = finalDoc.getPage(i);
        const { width, height } = page.getSize();
        page.drawPage(embeddedText, { x: 0, y: 0, width, height });
    }

    return finalDoc.save();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
async function generateContractPDF(data) {
    const textPdfBuffer = await generateTextOnlyPdf(data);
    console.log('📄 Text PDF generated, size:', textPdfBuffer.length);

    if (fs.existsSync(LETTERHEAD_PATH)) {
        const mergedBytes = await mergeWithLetterhead(textPdfBuffer);
        console.log('📄 Merged with letterhead, size:', mergedBytes.length);
        return Buffer.from(mergedBytes);
    }

    return textPdfBuffer;
}

module.exports = { generateContractPDF, generateContractNumber, formatDate };

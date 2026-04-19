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
const SIGNATURE_PATH = path.join(__dirname, '..', 'public', 'images', 'signature.png');

function findFont(paths) {
    for (const p of paths) { try { if (fs.existsSync(p)) return p; } catch (e) { } } return null;
}
function formatDate(d) {
    if (!d) return '__ / __ / ____';
    const x = new Date(d);
    return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
}
function formatCurrency(a, c = 'EUR') {
    if (!a && a !== 0) return '';
    return `${parseFloat(a).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;
}
function numberToTurkishText(n) {
    if (!n && n !== 0) return '';
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
            const { user, applications, services, guardians } = data;
            
            // Debug logging
            console.log('📋 Contract data:', {
                userId: user?.id,
                name: `${user?.first_name || ''} ${user?.last_name || ''}`,
                guardianCount: (guardians || []).length,
                applicationCount: (applications || []).length,
                serviceCount: (services || []).length,
                hasGuardians: (guardians || []).length > 0
            });
            
            const fp = findFont(FONT_PATHS), fb = findFont(FONT_BOLD_PATHS);
            console.log('🔤 Fonts found:', { regular: !!fp, bold: !!fb });

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

            // ── Data (eksik bilgiler boş bırakılır) ──
            const today = formatDate(new Date());
            const sn = `${user.first_name || ''} ${user.last_name || ''}`.trim() || '';
            const tc = user.tc_number || '';
            const bd = formatDate(user.birth_date);
            const pp = user.passport_number || '';
            const app = applications && applications.length > 0 ? applications[0] : null;
            const country = (app && app.country) || user.desired_country || '';
            const program = (app && app.program_name) || '';
            const bl = '';

            // Payment: filter services by name for proper categorization
            let svcs = (services || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            const cur = (svcs[0] && svcs[0].currency) || 'EUR';
            const total = svcs.reduce((s, x) => s + parseFloat(x.amount || 0), 0);

            // Find services by type (name-based matching).
            // svcPrep = 11th grade prep service (only shows installment if this exists)
            // svcPre  = kabul öncesi (pre-acceptance)
            // svcPost = kabul sonrası (post-acceptance)
            const svcPrep = svcs.find(s => s.service_name && (
                s.service_name.includes('11') ||
                s.service_name.toLowerCase().includes('hazirlik') ||
                s.service_name.toLowerCase().includes('hazırlık')
            )) || null;
            const svcPre = svcs.find(s => s.service_name && (
                s.service_name.toLowerCase().includes('kabul oncesi') ||
                s.service_name.toLowerCase().includes('kabul öncesi')
            )) || null;
            const svcPost = svcs.find(s => s.service_name && (
                s.service_name.toLowerCase().includes('kabul sonrasi') ||
                s.service_name.toLowerCase().includes('kabul sonrası')
            )) || null;

            // Show 11th grade installment ONLY if the prep service is actually assigned.
            // Fall back to positional matching for pre/post services if name match fails.
            const has11thService = svcPrep !== null;
            const s1 = svcPre || (has11thService ? svcs[1] : svcs[0]) || null;
            const s2 = svcPost || (has11thService ? svcs[2] : svcs[1]) || null;
            const a1 = s1 ? parseFloat(s1.amount) : null, a2 = s2 ? parseFloat(s2.amount) : null;
            const paid1 = s1 ? s1.is_paid : false, paid2 = s2 ? s2.is_paid : false;
            const pd1 = s1 && s1.payment_date ? formatDate(s1.payment_date) : '__ / __ / ____';
            const pd2 = s2 && s2.payment_date ? formatDate(s2.payment_date) : '__ / __ / ____';

            // 11th grade specific payment data
            const aPrep = svcPrep ? parseFloat(svcPrep.amount) : null;
            const paidPrep = svcPrep ? svcPrep.is_paid : false;
            const pdPrep = svcPrep && svcPrep.payment_date ? formatDate(svcPrep.payment_date) : '__ / __ / ____';

            const PW = doc.page.width - 130; // usable text width
            const ML = 65;
            const RX = doc.page.width - 65;
            const CLR = { dk: '#1a365d', tx: '#222', mu: '#777' };

            // Font sizes – larger for readability
            const SZ = { title: 17, sec: 14, body: 12, field: 11.5, label: 11.5, small: 10.5, tiny: 9.5 };

            // ── Helpers ──
            function section(title) {
                doc.moveDown(0.7);
                doc.font('B').fontSize(SZ.sec).fillColor(CLR.dk).text(title, ML);
                const y = doc.y + 3;
                doc.moveTo(ML, y).lineTo(RX, y).strokeColor(CLR.dk).lineWidth(0.5).stroke();
                doc.y = y + 7;
            }

            function field(label, value) {
                doc.font('B').fontSize(SZ.field).fillColor('#444').text(label, ML, doc.y, { continued: true, width: PW });
                doc.font('R').fontSize(SZ.field).fillColor(CLR.tx).text(' ' + value, { width: PW });
                doc.moveDown(0.1);
            }

            function para(text) {
                doc.font('R').fontSize(SZ.body).fillColor(CLR.tx).text(text, ML, doc.y, { width: PW, lineGap: 4.5, align: 'left' });
            }

            function item(num, text) {
                doc.font('R').fontSize(SZ.body).fillColor(CLR.tx).text(`${num} ${text}`, ML, doc.y, { width: PW, lineGap: 4, align: 'left' });
            }

            function bullet(text) {
                doc.font('R').fontSize(SZ.body).fillColor(CLR.tx).text(`• ${text}`, ML, doc.y, { width: PW, lineGap: 3.5, align: 'left' });
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

            doc.font('B').fontSize(SZ.body).fillColor(CLR.dk).text('1. DANIŞMAN', ML);
            doc.moveDown(0.15);
            field('Unvan:', 'VG DANISMANLIK LTD');
            field('Adres:', 'Na Větriniku 2513/4 Prag Çekya');
            field('Telefon:', '+90 539 927 30 08');
            field('E-posta:', 'info@vgedu.org');
            field('Web:', 'www.vgdanismanlik.com');
            field('TL IBAN:', 'TR56 0006 4000 0011 2120 9085 60');
            field('EUR IBAN:', 'TR56 0006 4000 0011 2120 9085 60');
            doc.font('R').fontSize(SZ.small).fillColor(CLR.mu).text('(Bundan böyle "DANIŞMAN" olarak anılacaktır.)', ML);
            doc.moveDown(0.35);

            // Find primary guardian (prefer Baba, then Anne, then first available)
            const primaryGuardian = (guardians || []).find(g => g.relationship === 'Baba') 
                || (guardians || []).find(g => g.relationship === 'Anne') 
                || (guardians || [])[0] || null;
            const gName = (primaryGuardian && primaryGuardian.full_name) || '';
            const gTc = (primaryGuardian && primaryGuardian.tc_number) || '';
            const gAddr = (primaryGuardian && primaryGuardian.address) || '';
            const gPhone = (primaryGuardian && primaryGuardian.phone) || '';
            const gEmail = (primaryGuardian && primaryGuardian.email) || '';

            doc.font('B').fontSize(SZ.body).fillColor(CLR.dk).text('2. VELİ / YASAL TEMSİLCİ', ML);
            doc.moveDown(0.15);
            field('Adı Soyadı:', gName);
            field('T.C. Kimlik No:', gTc);
            field('Adres:', gAddr);
            field('Telefon:', gPhone);
            field('E-posta:', gEmail);
            doc.font('R').fontSize(SZ.small).fillColor(CLR.mu).text('(Bundan böyle "VELİ" olarak anılacaktır.)', ML);
            doc.moveDown(0.35);

            doc.font('B').fontSize(SZ.body).fillColor(CLR.dk).text('3. ÖĞRENCİ (Hizmetten Faydalanacak Kişi)', ML);
            doc.moveDown(0.15);
            field('Adı Soyadı:', sn);
            field('T.C. Kimlik No:', tc);
            field('Doğum Tarihi:', bd);
            field('Pasaport No:', pp);
            doc.font('R').fontSize(SZ.small).fillColor(CLR.mu).text('(Bundan böyle "ÖĞRENCİ" olarak anılacaktır.)', ML);

            // ── MADDE 1 ──
            checkPage(90);
            section('MADDE 1 – SÖZLEŞMENİN KONUSU');
            para('İşbu sözleşme, DANIŞMAN\'ın ÖĞRENCİ\'ye yurt dışında yükseköğretim eğitimi alabilmesi için danışmanlık hizmeti vermesine ilişkin tarafların karşılıklı hak ve yükümlülüklerini düzenlemektedir.');
            doc.moveDown(0.25);
            field('Hedef Ülke/Ülkeler:', country);
            field('Hedef Dönem:', data.targetPeriod || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`);

            // ── MADDE 2 ──
            checkPage(100);
            section('MADDE 2 – DANIŞMANLIK HİZMETLERİ (DAHİL OLAN)');
            para('DANIŞMAN, işbu sözleşme kapsamında aşağıdaki hizmetleri sunmayı taahhüt eder:');
            doc.moveDown(0.25);

            if (has11thService) {
                // ── 11. SINIF HİZMETİ ATANMIŞ: Two-phase service listing ──

                // A) 11. Sınıf Hizmetleri
                checkPage(40);
                doc.font('B').fontSize(SZ.sec - 1).fillColor(CLR.dk).text('A) 11. SINIF HİZMETLERİ (Başvuruya Hazırlık Dönemi)', ML, doc.y, { width: PW });
                doc.moveDown(0.3);

                const svcList11 = [
                    ['2.1. Lise Ders Seçimleri ve Akademik Yönlendirme', ['Öğrencinin hedef üniversite ve bölümüne uygun ders seçimlerinin planlanması', 'Akademik performansın güçlendirilmesine yönelik stratejik rehberlik']],
                    ['2.2. Öğrenci Portfolyosunun Oluşturulması', ['Öğrencinin akademik başarıları, extrakuriküler aktiviteleri ve projelerinin derlenmesi', 'Üniversite başvurularına uygun güçlü bir portfolyo hazırlanması']],
                    ['2.3. Üniversite Giriş Sınavlarına Hazırlık', ['Hedef ülke ve üniversiteye göre gerekli sınavların (SAT, ACT vb.) belirlenmesi', 'Sınav hazırlık planının oluşturulması ve takibi']],
                    ['2.4. İhtiyaca Göre Özel Ders Koordinasyonu', ['Öğrencinin akademik ihtiyaçlarına yönelik özel ders ayarlanması', 'Ders programının takibi ve performans değerlendirmesi']],
                    ['2.5. Özgeçmiş (CV) Hazırlanması', ['Öğrencinin akademik ve kişisel deneyimlerini ön plana çıkaran profesyonel CV oluşturulması']],
                    ['2.6. Motivasyon Mektuplarının Hazırlanması', ['Hedef üniversitelere özel motivasyon mektuplarının yazımında rehberlik', 'Mektupların düzenlenmesi ve nihai hale getirilmesi']],
                    ['2.7. Referans Mektuplarının Hazırlanması', ['Uygun referans kişilerinin belirlenmesi', 'Referans mektubu yazım sürecinde öğretmenlere ve danışmanlara rehberlik']],
                    ['2.8. Dil Sınavlarına Ön Danışmanlık ve Hazırlık Planı', ['IELTS, TOEFL gibi dil sınavları için ön değerlendirme ve hazırlık stratejisinin oluşturulması', 'Sınav tarihlerinin planlanması ve kayıt sürecinde destek']],
                    ['2.9. Bölüm Seçimi İçin Psikolojik Destek ve Kariyer Yönlendirmesi', ['Öğrencinin ilgi alanları, yetenekleri ve kariyer hedeflerine yönelik kapsamlı değerlendirme', 'Henüz bölüm kararı netleşmemiş öğrenciler için profesyonel yönlendirme ve psikolojik destek']]
                ];

                for (const [title, items] of svcList11) {
                    checkPage(30 + items.length * 18);
                    doc.font('B').fontSize(SZ.body).fillColor(CLR.dk).text(title, ML, doc.y, { width: PW });
                    doc.moveDown(0.1);
                    for (const it of items) { bullet(it); }
                    doc.moveDown(0.2);
                }

                // B) 12. Sınıf Hizmetleri
                checkPage(40);
                doc.moveDown(0.3);
                doc.font('B').fontSize(SZ.sec - 1).fillColor(CLR.dk).text('B) 12. SINIF HİZMETLERİ (Başvuru ve Yerleşim Dönemi)', ML, doc.y, { width: PW });
                doc.moveDown(0.3);

                const svcList12 = [
                    ['2.10. Öğrenci Profili ve İhtiyaç Analizi', ['Öğrencinin akademik geçmişi, ilgi alanları ve hedeflerine yönelik ayrıntılı analiz ve değerlendirme']],
                    ['2.11. Üniversite Seçimi ve Yönlendirme', ['Öğrencinin profiline uygun üniversite ve programların belirlenmesi', 'Başvuru stratejisinin oluşturulması']],
                    ['2.12. Başvuru Dosyası Hazırlama', ['Gerekli belgelerin listelenmesi', 'Motivasyon mektubu yazımında rehberlik', 'Özgeçmiş (CV) hazırlanmasında destek', 'Başvuru formlarının doldurulmasında yardım']],
                    ['2.13. Başvuru Takibi', ['Üniversite başvurularının yapılması ve takibi', 'Kabul mektubunun teslim sürecinin takibi']],
                    ['2.14. Vize Danışmanlığı', ['Vize başvurusu için gerekli belgelerin hazırlanması', 'Başvuru formunun doldurulmasında yardım', 'Vize randevusu alınmasında destek', 'Başvuru sürecinin takibi']],
                    ['2.15. Konaklama Düzenlemeleri', ['Öğrenci yurdu veya özel konaklama seçeneklerinin araştırılması', 'Konaklama rezervasyonunda yardım']],
                    ['2.16. Varış Öncesi Hazırlık', ['Gidiş öncesi bilgilendirme ve oryantasyon', 'Gerekli eşya ve belge listesi hazırlanması']],
                    ['2.17. Varış Sonrası Destek (Çek Cumhuriyeti için)', ['Prag Havalimanı\'nda karşılama ve transfer', 'SIM kart temini konusunda yardım', 'Banka hesabı açılmasında destek', 'İlk günlerde şehir oryantasyonu']],
                    ['2.18. Sürekli Destek', ['Eğitim süreci boyunca 7/24 iletişim hattı', 'Acil durumlarda destek']]
                ];

                for (const [title, items] of svcList12) {
                    checkPage(30 + items.length * 18);
                    doc.font('B').fontSize(SZ.body).fillColor(CLR.dk).text(title, ML, doc.y, { width: PW });
                    doc.moveDown(0.1);
                    for (const it of items) { bullet(it); }
                    doc.moveDown(0.2);
                }

            } else {
                // ── 12. SINIF (veya diğer): Mevcut tek bölüm hizmet listesi ──
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
                checkPage(30 + items.length * 18);
                doc.font('B').fontSize(SZ.body).fillColor(CLR.dk).text(title, ML, doc.y, { width: PW });
                doc.moveDown(0.1);
                for (const it of items) { bullet(it); }
                doc.moveDown(0.2);
                }
            }

            // ── MADDE 3 ──
            checkPage(110);
            section('MADDE 3 – DAHİL OLMAYAN HİZMETLER VE MASRAFLAR');
            para('Aşağıdaki masraflar işbu sözleşme kapsamı dışındadır ve VELİ/ÖĞRENCİ tarafından ayrıca karşılanacaktır:');
            doc.moveDown(0.2);
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
            for (const e of excl) { item('', e); doc.moveDown(0.05); }

            // ── MADDE 4 ──
            checkPage(120);
            section('MADDE 4 – DANIŞMANLIK ÜCRETİ VE ÖDEME KOŞULLARI');

            const totalStr = total > 0 ? formatCurrency(total, cur) : '';
            const totalTxt = total > 0 ? numberToTurkishText(total) : '';
            const inst1 = a1 ? formatCurrency(a1, cur) : '';
            const inst2 = a2 ? formatCurrency(a2, cur) : '';
            const instPrep = aPrep ? formatCurrency(aPrep, cur) : '';

            doc.font('B').fontSize(SZ.body).fillColor(CLR.tx)
                .text(`4.1. Toplam Danışmanlık Ücreti: ${totalStr}`, ML, doc.y, { width: PW });
            doc.font('R').fontSize(SZ.body)
                .text(`(Yazıyla: ${totalTxt} Euro)`, ML, doc.y, { width: PW });
            doc.moveDown(0.3);

            doc.font('B').fontSize(SZ.body).text('4.2. Ödeme Planı:', ML);
            doc.moveDown(0.15);

            if (has11thService) {
                // ── 11. Sınıf hizmeti atanmış: 3 Taksitli Ödeme Planı ──
                doc.font('B').fontSize(SZ.body)
                    .text(`a) BİRİNCİ TAKSİT (11. Sınıf Başvuruya Hazırlık Ücreti): ${instPrep}`, ML, doc.y, { width: PW });
                doc.font('R').fontSize(SZ.body)
                    .text('İşbu sözleşmenin imzalanması ile birlikte peşin olarak ödenir. Bu ödeme, 11. sınıf döneminde sunulacak başvuruya hazırlık danışmanlık hizmetlerinin karşılığı olup, hizmetin fiilen başladığını gösterir.', ML, doc.y, { width: PW, lineGap: 4 });
                doc.moveDown(0.25);

                doc.font('B').fontSize(SZ.body)
                    .text(`b) İKİNCİ TAKSİT (Kabul Öncesi Danışmanlık Ücreti): ${inst1}`, ML, doc.y, { width: PW });
                doc.font('R').fontSize(SZ.body)
                    .text('Öğrencinin 12. sınıfa geçmesi ile birlikte, üniversite başvuru sürecinin fiilen başlaması üzerine ödenir. Bu ödeme, 12. sınıf döneminde sunulacak başvuru danışmanlık hizmetlerinin karşılığıdır.', ML, doc.y, { width: PW, lineGap: 4 });
                doc.moveDown(0.25);

                doc.font('B').fontSize(SZ.body)
                    .text(`c) ÜÇÜNCÜ TAKSİT (Kabul Sonrası Danışmanlık Ücreti): ${inst2}`, ML, doc.y, { width: PW });
                doc.font('R').fontSize(SZ.body)
                    .text('Öğrencinin hedef üniversitelerden birine kabul alması halinde, kabul mektubunun tesliminden itibaren 7 (yedi) iş günü içinde ödenir.', ML, doc.y, { width: PW, lineGap: 4 });
                doc.moveDown(0.3);
            } else {
                // ── 12. Sınıf (veya diğer): Mevcut 2 Taksitli Ödeme Planı ──
            doc.font('B').fontSize(SZ.body)
                .text(`a) BİRİNCİ TAKSİT (Kabul Öncesi Danışmanlık Ücreti): ${inst1}`, ML, doc.y, { width: PW });
            doc.font('R').fontSize(SZ.body)
                .text('İşbu sözleşmenin imzalanması ile birlikte peşin olarak ödenir. Bu ödeme, danışmanlık hizmetinin başlangıç bedeli olup, hizmetin fiilen başladığını gösterir.', ML, doc.y, { width: PW, lineGap: 4 });
            doc.moveDown(0.25);

            doc.font('B').fontSize(SZ.body)
                .text(`b) İKİNCİ TAKSİT (Kabul Sonrası Danışmanlık Ücreti): ${inst2}`, ML, doc.y, { width: PW });
            doc.font('R').fontSize(SZ.body)
                .text('Öğrencinin hedef üniversitelerden birine kabul alması halinde, kabul mektubunun tesliminden itibaren 7 (yedi) iş günü içinde ödenir.', ML, doc.y, { width: PW, lineGap: 4 });
            doc.moveDown(0.3);
            }

            doc.font('B').fontSize(SZ.body).text(`4.3. Ödeme Yöntemi:`, ML);
            para('Ödemeler, yukarıda belirtilen IBAN numaralarına havale/EFT yoluyla veya nakit olarak yapılabilir. Havale açıklamasına ÖĞRENCİ\'nin adı soyadı yazılmalıdır.');
            doc.moveDown(0.25);

            doc.font('B').fontSize(SZ.body).text('4.4. Döviz Kuru:', ML);
            para('EUR cinsinden belirlenen ücretler, ödeme günündeki T.C. Merkez Bankası EUR efektif satış kuru üzerinden TL\'ye çevrilebilir.');
            doc.moveDown(0.25);

            doc.font('B').fontSize(SZ.body).text('4.5. Ödeme Gecikmesi ve Hizmetin Askıya Alınması:', ML);
            para('Vadesi gelen taksit ödenmediği takdirde, DANIŞMAN ödeme yapılana kadar tüm danışmanlık hizmetlerini askıya alma hakkını saklı tutar. Hizmetin askıya alındığı süre zarfında oluşabilecek başvuru süresi gecikmelerinden, kontenjan dolmasından veya vize randevu kaybından DANIŞMAN sorumlu tutulamaz.');
            doc.moveDown(0.25);

            doc.font('B').fontSize(SZ.body).text('4.6. Vize İşlemlerinin Başlama Koşulu:', ML);
            para('Vize danışmanlığı ve vize başvuru işlemleri, kabul sonrası danışmanlık ücretinin (son taksit) tam olarak ödenmesinin ardından başlatılır. Bu ödeme yapılmadan vize sürecine ilişkin hizmetler sunulmayacaktır.');

            // ── MADDE 5 ──
            checkPage(100);
            section('MADDE 5 – İADE POLİTİKASI');

            if (has11thService) {
                // ── 11. Sınıf hizmeti atanmış: 3 Taksitli İade Politikası ──
                doc.font('B').fontSize(SZ.body).text('5.1. Birinci Taksit (11. Sınıf Başvuruya Hazırlık Ücreti) İadesi:', ML);
                para('Birinci taksit, sözleşmenin imzalanması ve 11. sınıf hazırlık hizmetlerinin başlaması ile birlikte İADE EDİLMEZ niteliğindedir. VELİ veya ÖĞRENCİ\'nin herhangi bir sebeple danışmanlık hizmetinden vazgeçmesi halinde, bu tutar verilen hizmetin karşılığı olarak DANIŞMAN\'da kalacaktır.');
                doc.moveDown(0.25);

                doc.font('B').fontSize(SZ.body).text('5.2. İkinci Taksit (Kabul Öncesi Danışmanlık Ücreti):', ML);
                para('a) İkinci taksit, 12. sınıf başvuru sürecinin başlaması ile ödenir ve İADE EDİLMEZ niteliğindedir.');
                doc.moveDown(0.1);
                para('b) VELİ veya ÖĞRENCİ\'nin 12. sınıf başvuru sürecinden önce danışmanlık hizmetinden vazgeçmesi halinde, ikinci taksit talep edilmez.');
                doc.moveDown(0.25);

                doc.font('B').fontSize(SZ.body).text('5.3. Üçüncü Taksit (Kabul Sonrası Danışmanlık Ücreti):', ML);
                para('a) ÖĞRENCİ, başvurduğu üniversitelerin hiçbirinden kabul alamaması durumunda üçüncü taksit talep edilmez.');
                doc.moveDown(0.1);
                para('b) ÖĞRENCİ kabul aldığı halde kendi isteğiyle eğitimden vazgeçerse, üçüncü taksit tam olarak ödenir.');
                doc.moveDown(0.25);

                doc.font('B').fontSize(SZ.body).text('5.4. Mücbir Sebepler:', ML);
                para('Savaş, doğal afet, pandemi gibi mücbir sebeplerden kaynaklanan aksaklıklarda taraflar karşılıklı mutabakat ile çözüm arayacaktır.');
            } else {
                // ── 12. Sınıf (veya diğer): Mevcut İade Politikası ──
            doc.font('B').fontSize(SZ.body).text('5.1. Birinci Taksit İadesi:', ML);
            para('Birinci taksit, sözleşmenin imzalanması ve hizmetin başlaması ile birlikte İADE EDİLMEZ niteliğindedir. VELİ veya ÖĞRENCİ\'nin herhangi bir sebeple danışmanlık hizmetinden vazgeçmesi halinde, bu tutar verilen hizmetin karşılığı olarak DANIŞMAN\'da kalacaktır.');
            doc.moveDown(0.25);

            doc.font('B').fontSize(SZ.body).text('5.2. İkinci Taksit:', ML);
            para('a) ÖĞRENCİ, başvurduğu üniversitelerin hiçbirinden kabul alamaması durumunda ikinci taksit talep edilmez.');
            doc.moveDown(0.1);
            para('b) ÖĞRENCİ kabul aldığı halde kendi isteğiyle eğitimden vazgeçerse, ikinci taksit tam olarak ödenir.');
            doc.moveDown(0.25);

            doc.font('B').fontSize(SZ.body).text('5.3. Mücbir Sebepler:', ML);
            para('Savaş, doğal afet, pandemi gibi mücbir sebeplerden kaynaklanan aksaklıklarda taraflar karşılıklı mutabakat ile çözüm arayacaktır.');
            }

            // ── MADDE 6 ──
            checkPage(140);
            section('MADDE 6 – GARANTİ, VİZE REDDİ VE SORUMLULUK SINIRI');
            item('6.1.', 'DANIŞMAN, üniversite başvuruları veya vize başvuruları için kabul ya da onay garantisi vermemektedir. Bu sonuçlar tamamen ilgili kurumların yetkisindedir. DANIŞMAN\'ın yükümlülüğü, profesyonel danışmanlık hizmeti sunmak ile sınırlıdır. Olumsuz sonuçlar iade veya tazminat hakkı doğurmaz.');
            item('6.2.', 'ÖĞRENCİ\'nin hedef üniversitelerin hiçbirinden kabul alamaması durumunda, Madde 5 hükümleri uyarınca kabul sonrası danışmanlık ücreti (son taksit) talep edilmez.');
            item('6.3.', 'DANIŞMAN, vize başvuru sürecinde rehberlik ve destek sağlamakla yükümlüdür. Ancak vize başvurusunun kabul veya reddi tamamen ilgili ülkenin konsolosluk/büyükelçiliğinin yetkisindedir. Vize kararı ÖĞRENCİ\'nin bireysel profili (mali durum, seyahat geçmişi, bağlanma riski vb.) temelinde verilmekte olup DANIŞMAN\'ın vize sonucu üzerinde herhangi bir etkisi bulunmamaktadır.');
            item('6.4.', 'Vize reddi halinde DANIŞMAN\'ın herhangi bir sorumluluğu bulunmamaktadır. Vize reddi, iade veya tazminat hakkı doğurmaz.');
            item('6.5.', 'Vize reddi durumunda, VELİ/ÖĞRENCİ\'nin talebi halinde DANIŞMAN, ilave ücret talep etmeksizin yeniden başvuru sürecinde destek sağlayacaktır (sadece danışmanlık hizmeti – harç ve masraflar hariç).');
            item('6.6.', 'DANIŞMAN\'ın işbu sözleşme kapsamındaki toplam sorumluluğu, her halükarda VELİ tarafından ödenen toplam danışmanlık ücretini aşamaz.');

            // ── MADDE 7 ──
            checkPage(130);
            section('MADDE 7 – TARAFLARIN YÜKÜMLÜLÜKLERİ');

            doc.font('B').fontSize(SZ.body).text('7.1. DANIŞMAN\'ın Yükümlülükleri:', ML);
            doc.moveDown(0.1);
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
                    .text(`${abc[i]}) ${dYuk[i]}`, ML, doc.y, { width: PW, lineGap: 4 });
            }
            doc.moveDown(0.3);

            checkPage(100);
            doc.font('B').fontSize(SZ.body).text('7.2. VELİ ve ÖĞRENCİ\'nin Yükümlülükleri:', ML);
            doc.moveDown(0.1);
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
                    .text(`${abc[i]}) ${vYuk[i]}`, ML, doc.y, { width: PW, lineGap: 4 });
            }
            doc.moveDown(0.15);
            item('7.3.', 'Yanlış veya eksik bilgi verilmesi nedeniyle doğacak tüm sorumluluk VELİ ve ÖĞRENCİ\'ye aittir.');
            doc.moveDown(0.1);
            item('7.4.', 'VELİ/ÖĞRENCİ, DANIŞMAN tarafından talep edilen belgeleri, talep tarihinden itibaren en geç 10 (on) iş günü içinde teslim etmekle yükümlüdür. Belgelerin geç veya eksik teslimi nedeniyle başvuru süresinin kaçırılması, kontenjan dolması veya vize sürecinin aksaması halinde DANIŞMAN sorumlu tutulamaz ve iade talebi yapılamaz.');
            doc.moveDown(0.1);
            item('7.5.', 'VELİ/ÖĞRENCİ, DANIŞMAN\'ın e-posta, telefon veya mesaj yoluyla ilettiği bildirimlere en geç 48 (kırk sekiz) saat içinde yanıt vermekle yükümlüdür. Yanıt verilmemesi nedeniyle kaçırılan fırsatlardan DANIŞMAN sorumlu tutulamaz.');

            // ── MADDE 8 ──
            checkPage(90);
            section('MADDE 8 – GİZLİLİK VE KVKK');
            item('8.1.', 'DANIŞMAN, işbu sözleşme kapsamında edindiği tüm kişisel bilgileri 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") hükümlerine uygun olarak işleyeceğini ve koruyacağını taahhüt eder.');
            doc.moveDown(0.1);
            item('8.2.', 'Kişisel veriler yalnızca aşağıdaki amaçlarla kullanılacaktır:');
            doc.moveDown(0.1);
            bullet('Üniversite başvurularının yapılması');
            bullet('Vize başvuru işlemlerinin yürütülmesi');
            bullet('Konaklama düzenlemelerinin sağlanması');
            bullet('İletişim ve bilgilendirme');
            doc.moveDown(0.1);
            item('8.3.', 'VELİ ve ÖĞRENCİ, kişisel verilerinin yukarıda belirtilen amaçlarla yurt dışındaki üniversiteler, konsolosluklar ve konaklama sağlayıcıları ile paylaşılmasına açıkça onay vermektedir.');
            doc.moveDown(0.1);
            item('8.4.', 'Taraflar, sözleşme şartlarını ve ücret bilgilerini üçüncü şahıslarla paylaşmamayı kabul eder.');
            doc.moveDown(0.1);
            item('8.5.', 'VELİ ve ÖĞRENCİ, DANIŞMAN\'ın ÖĞRENCİ\'nin yerleştirme sürecine ilişkin bilgileri, fotoğrafları ve görselleri kurumsal tanıtım, sosyal medya paylaşımları ve referans amaçlı kullanmasına onay vermektedir. DANIŞMAN, paylaşımlarda ÖĞRENCİ\'nin adını kullanabilir.');

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
            doc.text('VG DANISMANLIK LTD', lx, sy, { width: colW });
            doc.text('Adı Soyadı: ' + gName, rx, sy, { width: colW });
            doc.text('T.C. Kimlik No: ' + gTc, rx, doc.y, { width: colW });
            sy = Math.max(doc.y, sy + 24) + 8;

            // Signature row — image only on DANIŞMAN side, blank line on VELİ side
            const sigRowY = sy;
            let hasSigImage = false;
            if (fs.existsSync(SIGNATURE_PATH)) {
                try {
                    doc.image(SIGNATURE_PATH, lx, sigRowY - 22, { width: 130 });
                    hasSigImage = true;
                } catch (sigErr) {
                    console.warn('⚠️ Signature image embed failed:', sigErr.message);
                }
            }
            if (!hasSigImage) {
                doc.text('İmza: ___________________', lx, sigRowY);
            }
            doc.text('İmza: ___________________', rx, sigRowY);
            sy = sigRowY + 52;
            doc.text('Tarih: ' + today, lx, sy);
            doc.text('Tarih: ' + today, rx, sy);

            // ── EK-1: ÖDEME MAKBUZU ──
            checkPage(has11thService ? 100 : 80);
            doc.moveDown(0.4);
            section('EK-1: ÖDEME MAKBUZU');
            doc.moveDown(0.15);

            doc.font('R').fontSize(SZ.body).fillColor(CLR.tx);
            if (has11thService) {
                // 11. Sınıf hizmeti atanmış: 3 taksit makbuzu
                doc.text(`${paidPrep ? '☑' : '☐'} 1. Taksit (11. Sınıf Hazırlık) Ödendi    Tarih: ${pdPrep}    Tutar: ${instPrep}`);
                doc.moveDown(0.25);
                doc.text(`${paid1 ? '☑' : '☐'} 2. Taksit (Kabul Öncesi) Ödendi    Tarih: ${pd1}    Tutar: ${inst1}`);
                doc.moveDown(0.25);
                doc.text(`${paid2 ? '☑' : '☐'} 3. Taksit (Kabul Sonrası) Ödendi    Tarih: ${pd2}    Tutar: ${inst2}`);
            } else {
                // 12. Sınıf (veya diğer): 2 taksit makbuzu
            doc.text(`${paid1 ? '☑' : '☐'} 1. Taksit Ödendi    Tarih: ${pd1}    Tutar: ${inst1}`);
            doc.moveDown(0.25);
            doc.text(`${paid2 ? '☑' : '☐'} 2. Taksit Ödendi    Tarih: ${pd2}    Tutar: ${inst2}`);
            }

            doc.moveDown(0.5);
            doc.moveTo(ML, doc.y).lineTo(RX, doc.y).strokeColor(CLR.dk).lineWidth(0.4).stroke();
            doc.moveDown(0.2);
            doc.font('R').fontSize(SZ.small).fillColor(CLR.mu)
                .text(`Bu sözleşme ${today} tarihinde Prag'da düzenlenmiştir.`, { align: 'center' });

            doc.end();
        } catch (e) { reject(e); }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Merge text pages onto letterhead template
// ─────────────────────────────────────────────────────────────────────────────
async function mergeWithLetterhead(textPdfBytes) {
    console.log('📄 Starting letterhead merge...');
    console.log('📄 Letterhead path:', LETTERHEAD_PATH);
    const letterheadBytes = fs.readFileSync(LETTERHEAD_PATH);
    console.log('📄 Letterhead size:', letterheadBytes.length, 'bytes');
    const textDoc = await PDFLibDocument.load(textPdfBytes);
    const letterheadDoc = await PDFLibDocument.load(letterheadBytes);
    const finalDoc = await PDFLibDocument.create();
    console.log('📄 Text pages:', textDoc.getPageCount(), '| Letterhead pages:', letterheadDoc.getPageCount());

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
        try {
            const mergedBytes = await mergeWithLetterhead(textPdfBuffer);
            console.log('📄 Merged with letterhead, size:', mergedBytes.length);
            return Buffer.from(mergedBytes);
        } catch (mergeErr) {
            console.error('⚠️ Letterhead merge failed, returning text-only PDF:', mergeErr.message);
            // Fallback: return text-only PDF rather than failing entirely
            return textPdfBuffer;
        }
    } else {
        console.warn('⚠️ Letterhead file not found at:', LETTERHEAD_PATH);
    }

    return textPdfBuffer;
}

module.exports = { generateContractPDF, generateContractNumber, formatDate };

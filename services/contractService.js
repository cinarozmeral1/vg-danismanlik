/**
 * Contract PDF Generation Service
 * Generates professional consultation contracts using PDFKit
 * with student data from the database.
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Font paths to try (Vercel Amazon Linux, macOS, Linux)
const FONT_PATHS = [
    path.join(__dirname, '..', 'public', 'fonts', 'DejaVuSans.ttf'),
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/TTF/DejaVuSans.ttf',
];

const FONT_BOLD_PATHS = [
    path.join(__dirname, '..', 'public', 'fonts', 'DejaVuSans-Bold.ttf'),
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
];

function findFont(paths) {
    for (const p of paths) {
        try {
            if (fs.existsSync(p)) return p;
        } catch (e) { /* ignore */ }
    }
    return null;
}

// Format date to Turkish format
function formatDate(date) {
    if (!date) return '___/___/______';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

// Format currency
function formatCurrency(amount, currency = 'EUR') {
    if (!amount && amount !== 0) return '____________';
    return `${parseFloat(amount).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

// Number to Turkish text (for amounts)
function numberToTurkishText(num) {
    if (!num && num !== 0) return '____________';
    const n = parseFloat(num);
    
    const ones = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
    const tens = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
    const thousands = ['', 'bin', 'milyon', 'milyar'];
    
    if (n === 0) return 'sıfır';
    
    const intPart = Math.floor(n);
    const decPart = Math.round((n - intPart) * 100);
    
    function convertGroup(num) {
        let result = '';
        const h = Math.floor(num / 100);
        const t = Math.floor((num % 100) / 10);
        const o = num % 10;
        
        if (h > 0) {
            result += (h === 1 ? '' : ones[h]) + 'yüz';
        }
        if (t > 0) result += tens[t];
        if (o > 0) result += ones[o];
        
        return result;
    }
    
    let result = '';
    let groupIndex = 0;
    let remaining = intPart;
    const groups = [];
    
    while (remaining > 0) {
        groups.push(remaining % 1000);
        remaining = Math.floor(remaining / 1000);
    }
    
    for (let i = groups.length - 1; i >= 0; i--) {
        if (groups[i] === 0) continue;
        
        // Special case: "bin" not "birbin"
        if (i === 1 && groups[i] === 1) {
            result += 'bin';
        } else {
            result += convertGroup(groups[i]) + thousands[i];
        }
    }
    
    if (!result) result = 'sıfır';
    
    // Capitalize first letter
    result = result.charAt(0).toUpperCase() + result.slice(1);
    
    return result;
}

// Generate contract number
function generateContractNumber(userId) {
    const year = new Date().getFullYear();
    const paddedId = String(userId).padStart(4, '0');
    return `VG-${year}-${paddedId}`;
}

/**
 * Generate a professional contract PDF
 * @param {Object} data - Contract data
 * @param {Object} data.user - User/student information
 * @param {Array} data.applications - Student's applications
 * @param {Array} data.services - Student's services
 * @param {Array} data.installments - Installments for services
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateContractPDF(data) {
    const { user, applications, services } = data;
    
    // Find suitable font for Turkish characters
    const fontPath = findFont(FONT_PATHS);
    const fontBoldPath = findFont(FONT_BOLD_PATHS);
    const useCustomFont = !!fontPath;
    
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 50, bottom: 50, left: 55, right: 55 },
                info: {
                    Title: `Danışmanlık Sözleşmesi - ${user.first_name} ${user.last_name}`,
                    Author: 'Venture Global Yurt Dışı Eğitim Danışmanlık',
                    Subject: 'Yurt Dışı Eğitim Danışmanlık Sözleşmesi',
                    Creator: 'Venture Global'
                },
                bufferPages: true
            });
            
            // Register custom fonts for Turkish character support
            if (useCustomFont) {
                doc.registerFont('Regular', fontPath);
                if (fontBoldPath) {
                    doc.registerFont('Bold', fontBoldPath);
                } else {
                    doc.registerFont('Bold', fontPath);
                }
            } else {
                doc.registerFont('Regular', 'Helvetica');
                doc.registerFont('Bold', 'Helvetica-Bold');
            }
            
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', err => reject(err));
            
            // Extract data
            const contractNo = generateContractNumber(user.id);
            const today = formatDate(new Date());
            const studentName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || '________________________';
            const tcNumber = user.tc_number || '________________________';
            const birthDate = formatDate(user.birth_date);
            const passportNo = user.passport_number || '________________________';
            
            // Get application info (use first application or desired_country)
            const app = applications && applications.length > 0 ? applications[0] : null;
            const targetCountry = (app && app.country) || user.desired_country || '________________________';
            const targetProgram = (app && app.program_name) || '________________________';
            
            // Get service/payment info (find the main consulting service)
            const mainService = services && services.length > 0 ? services[0] : null;
            const totalAmount = mainService ? mainService.amount : null;
            const currency = mainService ? (mainService.currency || 'EUR') : 'EUR';
            
            // Get installments
            let installmentsList = [];
            if (mainService && mainService.installments) {
                // installments might be a JSON string or array
                if (typeof mainService.installments === 'string') {
                    try {
                        installmentsList = JSON.parse(mainService.installments);
                    } catch(e) {
                        installmentsList = [];
                    }
                } else if (Array.isArray(mainService.installments)) {
                    installmentsList = mainService.installments;
                }
                // Filter out null entries
                installmentsList = installmentsList.filter(i => i && i.id);
            }
            
            // Sort installments by number
            installmentsList.sort((a, b) => (a.installment_number || 0) - (b.installment_number || 0));
            
            const firstInstallment = installmentsList.length > 0 ? installmentsList[0] : null;
            const secondInstallment = installmentsList.length > 1 ? installmentsList[1] : null;

            // Parent info (blank for now)
            const parentName = '________________________';
            const parentTc = '________________________';
            const parentAddress = '________________________';
            const parentPhone = '________________________';
            const parentEmail = '________________________';

            // Colors
            const primaryColor = '#1a365d';  // Dark navy
            const accentColor = '#2563eb';   // Blue
            const textColor = '#1a202c';     // Dark gray
            const lightGray = '#e2e8f0';
            
            // ============================================================
            // HELPER FUNCTIONS
            // ============================================================
            
            const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            
            function setFont(type, size) {
                if (type === 'bold') {
                    doc.font('Bold').fontSize(size || 10);
                } else {
                    doc.font('Regular').fontSize(size || 10);
                }
            }
            
            function drawHeader() {
                const y = doc.y;
                
                // Top line
                doc.moveTo(doc.page.margins.left, y)
                   .lineTo(doc.page.width - doc.page.margins.right, y)
                   .strokeColor(accentColor)
                   .lineWidth(2)
                   .stroke();
                
                doc.moveDown(0.5);
                
                // Company name
                setFont('bold', 16);
                doc.fillColor(primaryColor)
                   .text('VENTURE GLOBAL', { align: 'center' });
                
                setFont('regular', 9);
                doc.fillColor('#4a5568')
                   .text('YURT DIŞI EĞİTİM DANIŞMANLIK', { align: 'center' });
                
                doc.moveDown(0.3);
                
                // Bottom line
                const lineY = doc.y;
                doc.moveTo(doc.page.margins.left, lineY)
                   .lineTo(doc.page.width - doc.page.margins.right, lineY)
                   .strokeColor(accentColor)
                   .lineWidth(1)
                   .stroke();
                
                doc.moveDown(0.5);
            }
            
            function drawFooter(pageNum, totalPages) {
                const bottomY = doc.page.height - 35;
                
                doc.moveTo(doc.page.margins.left, bottomY - 10)
                   .lineTo(doc.page.width - doc.page.margins.right, bottomY - 10)
                   .strokeColor(lightGray)
                   .lineWidth(0.5)
                   .stroke();
                
                setFont('regular', 7);
                doc.fillColor('#a0aec0');
                
                doc.text(
                    '+90 539 927 30 08  |  www.vgdanismanlik.com  |  Na Větriniku 2513/4 Prag Çekya',
                    doc.page.margins.left, bottomY - 5,
                    { width: pageWidth * 0.7, align: 'left' }
                );
                
                doc.text(
                    `Sayfa ${pageNum}/${totalPages}`,
                    doc.page.margins.left, bottomY - 5,
                    { width: pageWidth, align: 'right' }
                );
            }
            
            function sectionTitle(text) {
                doc.moveDown(0.5);
                const y = doc.y;
                
                // Background bar
                doc.rect(doc.page.margins.left, y, pageWidth, 22)
                   .fill(primaryColor);
                
                setFont('bold', 11);
                doc.fillColor('#ffffff')
                   .text(text, doc.page.margins.left + 10, y + 5, { width: pageWidth - 20 });
                
                doc.fillColor(textColor);
                doc.y = y + 28;
                doc.moveDown(0.3);
            }
            
            function labelValue(label, value, indent = 0) {
                const x = doc.page.margins.left + indent;
                setFont('bold', 9);
                doc.fillColor('#4a5568')
                   .text(label, x, doc.y, { continued: true, width: pageWidth - indent });
                setFont('regular', 9);
                doc.fillColor(textColor)
                   .text(` ${value || '________________________'}`, { width: pageWidth - indent });
            }
            
            function bodyText(text, options = {}) {
                setFont('regular', 9);
                doc.fillColor(textColor)
                   .text(text, {
                       width: pageWidth - (options.indent || 0),
                       align: options.align || 'left',
                       indent: options.indent || 0,
                       lineGap: 2,
                       ...options
                   });
            }
            
            function bulletPoint(text, indent = 15) {
                const x = doc.page.margins.left + indent;
                setFont('regular', 9);
                doc.fillColor(textColor)
                   .text(`•  ${text}`, x, doc.y, { width: pageWidth - indent - 10, lineGap: 1 });
            }
            
            function subSection(number, title) {
                doc.moveDown(0.3);
                setFont('bold', 9);
                doc.fillColor(primaryColor)
                   .text(`${number} ${title}`, doc.page.margins.left, doc.y, { width: pageWidth });
            }
            
            function checkPageSpace(needed) {
                const remaining = doc.page.height - doc.page.margins.bottom - doc.y;
                if (remaining < needed) {
                    doc.addPage();
                    drawHeader();
                }
            }
            
            // ============================================================
            // PAGE 1 - HEADER & PARTIES
            // ============================================================
            
            drawHeader();
            
            // Title
            setFont('bold', 18);
            doc.fillColor(primaryColor)
               .text('YURT DIŞI EĞİTİM DANIŞMANLIK', { align: 'center' });
            setFont('bold', 16);
            doc.text('SÖZLEŞMESİ', { align: 'center' });
            
            doc.moveDown(0.5);
            
            // Contract info line
            setFont('regular', 9);
            doc.fillColor('#4a5568');
            const contractInfoY = doc.y;
            doc.text(`Sözleşme No: ${contractNo}`, doc.page.margins.left, contractInfoY, { width: pageWidth / 2 });
            doc.text(`Düzenleme Tarihi: ${today}`, doc.page.margins.left + pageWidth / 2, contractInfoY, { width: pageWidth / 2, align: 'right' });
            
            doc.moveDown(0.5);
            
            // Separator
            doc.moveTo(doc.page.margins.left, doc.y)
               .lineTo(doc.page.width - doc.page.margins.right, doc.y)
               .strokeColor(lightGray)
               .lineWidth(0.5)
               .stroke();
            
            // ---- TARAFLAR ----
            sectionTitle('TARAFLAR');
            
            // 1. DANIŞMAN
            setFont('bold', 10);
            doc.fillColor(primaryColor)
               .text('1. DANIŞMAN');
            doc.moveDown(0.3);
            
            labelValue('Unvan:', 'Venture Global Yurt Dışı Eğitim Danışmanlık', 10);
            labelValue('Adres:', 'İstanbul, Türkiye', 10);
            labelValue('Telefon:', '+90 539 927 30 08', 10);
            labelValue('E-posta:', 'info@vgdanismanlik.com', 10);
            labelValue('Web Sitesi:', 'www.vgdanismanlik.com', 10);
            doc.moveDown(0.2);
            labelValue('TL IBAN:', 'TR56 0006 4000 0011 2120 9085 60', 10);
            labelValue('EUR IBAN:', 'TR56 0006 4000 0011 2120 9085 60', 10);
            
            doc.moveDown(0.2);
            setFont('regular', 8);
            doc.fillColor('#718096')
               .text('(Bundan böyle "DANIŞMAN" olarak anılacaktır.)', doc.page.margins.left + 10);
            
            doc.moveDown(0.5);
            
            // 2. VELİ / YASAL TEMSİLCİ
            setFont('bold', 10);
            doc.fillColor(primaryColor)
               .text('2. VELİ / YASAL TEMSİLCİ');
            doc.moveDown(0.3);
            
            labelValue('Adı Soyadı:', parentName, 10);
            labelValue('T.C. Kimlik No:', parentTc, 10);
            labelValue('Adres:', parentAddress, 10);
            labelValue('Telefon:', parentPhone, 10);
            labelValue('E-posta:', parentEmail, 10);
            
            doc.moveDown(0.2);
            setFont('regular', 8);
            doc.fillColor('#718096')
               .text('(Bundan böyle "VELİ" olarak anılacaktır.)', doc.page.margins.left + 10);
            
            doc.moveDown(0.5);
            
            // 3. ÖĞRENCİ
            setFont('bold', 10);
            doc.fillColor(primaryColor)
               .text('3. ÖĞRENCİ (Hizmetten Faydalanacak Kişi)');
            doc.moveDown(0.3);
            
            labelValue('Adı Soyadı:', studentName, 10);
            labelValue('T.C. Kimlik No:', tcNumber, 10);
            labelValue('Doğum Tarihi:', birthDate, 10);
            labelValue('Pasaport No:', passportNo, 10);
            
            doc.moveDown(0.2);
            setFont('regular', 8);
            doc.fillColor('#718096')
               .text('(Bundan böyle "ÖĞRENCİ" olarak anılacaktır.)', doc.page.margins.left + 10);
            
            // ============================================================
            // MADDE 1 - SÖZLEŞMENİN KONUSU
            // ============================================================
            
            checkPageSpace(120);
            sectionTitle('MADDE 1 - SÖZLEŞMENİN KONUSU');
            
            bodyText('İşbu sözleşme, DANIŞMAN\'ın ÖĞRENCİ\'ye yurt dışında yükseköğretim eğitimi alabilmesi için danışmanlık hizmeti vermesine ilişkin tarafların karşılıklı hak ve yükümlülüklerini düzenlemektedir.');
            
            doc.moveDown(0.5);
            
            labelValue('Hedef Ülke/Ülkeler:', targetCountry, 10);
            labelValue('Hedef Program:', targetProgram, 10);
            
            // Calculate target term
            const currentYear = new Date().getFullYear();
            const nextYear = currentYear + 1;
            labelValue('Hedef Dönem:', `${currentYear}-${nextYear}`, 10);
            
            // ============================================================
            // MADDE 2 - DANIŞMANLIK HİZMETLERİ
            // ============================================================
            
            checkPageSpace(200);
            sectionTitle('MADDE 2 - DANIŞMANLIK HİZMETLERİ (DAHİL OLAN)');
            
            bodyText('DANIŞMAN, işbu sözleşme kapsamında aşağıdaki hizmetleri sunmayı taahhüt eder:');
            doc.moveDown(0.3);
            
            const services2 = [
                { num: '2.1.', title: 'Öğrenci Profili ve İhtiyaç Analizi', items: ['Öğrencinin akademik geçmişi, ilgi alanları ve hedeflerine yönelik ayrıntılı analiz ve değerlendirme yapılması'] },
                { num: '2.2.', title: 'Üniversite Seçimi ve Yönlendirme', items: ['Öğrencinin profiline uygun üniversite ve programların belirlenmesi', 'Başvuru stratejisinin oluşturulması'] },
                { num: '2.3.', title: 'Başvuru Dosyası Hazırlama', items: ['Başvuru için gerekli belgelerin listelenmesi', 'Motivasyon mektubu (Statement of Purpose) yazımında rehberlik', 'Özgeçmiş (CV) hazırlanmasında destek', 'Başvuru formlarının doldurulmasında yardım'] },
                { num: '2.4.', title: 'Başvuru Takibi', items: ['Üniversite başvurularının yapılması ve takibi', 'Kabul mektubunun (Acceptance Letter) teslim sürecinin takibi'] },
                { num: '2.5.', title: 'Vize Danışmanlığı', items: ['Vize başvurusu için gerekli belgelerin hazırlanması', 'Vize başvuru formunun doldurulmasında yardım', 'Vize randevusu alınmasında destek', 'Başvuru sürecinin takibi'] },
                { num: '2.6.', title: 'Konaklama Düzenlemeleri', items: ['Öğrenci yurdu veya özel konaklama seçeneklerinin araştırılması', 'Konaklama rezervasyonunda yardım'] },
                { num: '2.7.', title: 'Varış Öncesi Hazırlık', items: ['Gidiş öncesi bilgilendirme ve oryantasyon', 'Gerekli eşya ve belge listesi hazırlanması'] },
                { num: '2.8.', title: 'Varış Sonrası Destek (Çek Cumhuriyeti için)', items: ['Prag Havalimanı\'nda karşılama ve transfer', 'SIM kart temini konusunda yardım', 'Banka hesabı açılmasında destek', 'İlk günlerde şehir oryantasyonu'] },
                { num: '2.9.', title: 'Sürekli Destek', items: ['Eğitim süreci boyunca 7/24 iletişim hattı', 'Acil durumlarda destek'] }
            ];
            
            for (const svc of services2) {
                checkPageSpace(60);
                subSection(svc.num, svc.title);
                for (const item of svc.items) {
                    bulletPoint(item, 25);
                }
            }
            
            // ============================================================
            // MADDE 3 - DAHİL OLMAYAN HİZMETLER
            // ============================================================
            
            checkPageSpace(150);
            sectionTitle('MADDE 3 - DAHİL OLMAYAN HİZMETLER VE MASRAFLAR');
            
            bodyText('Aşağıdaki masraflar işbu sözleşme kapsamı dışındadır ve VELİ/ÖĞRENCİ tarafından ayrıca karşılanacaktır:');
            doc.moveDown(0.3);
            
            const excludedItems = [
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
            
            for (const item of excludedItems) {
                setFont('regular', 9);
                doc.fillColor(textColor)
                   .text(item, doc.page.margins.left + 10, doc.y, { width: pageWidth - 20, lineGap: 2 });
            }
            
            // ============================================================
            // MADDE 4 - DANIŞMANLIK ÜCRETİ VE ÖDEME KOŞULLARI
            // ============================================================
            
            checkPageSpace(180);
            sectionTitle('MADDE 4 - DANIŞMANLIK ÜCRETİ VE ÖDEME KOŞULLARI');
            
            // 4.1 Total fee
            const totalAmountStr = totalAmount ? formatCurrency(totalAmount, currency) : '_________________ EUR';
            const totalAmountText = totalAmount ? numberToTurkishText(totalAmount) : '_________________';
            
            setFont('bold', 9);
            doc.fillColor(textColor)
               .text('4.1. Toplam Danışmanlık Ücreti: ', doc.page.margins.left + 10, doc.y, { continued: true });
            setFont('regular', 9);
            doc.text(totalAmountStr);
            setFont('regular', 9);
            doc.text(`     (Yazıyla: ${totalAmountText} Euro)`, doc.page.margins.left + 10);
            
            doc.moveDown(0.5);
            
            // 4.2 Payment plan
            setFont('bold', 9);
            doc.fillColor(textColor)
               .text('4.2. Ödeme Planı:', doc.page.margins.left + 10);
            doc.moveDown(0.3);
            
            // First installment
            const firstAmount = firstInstallment ? formatCurrency(firstInstallment.amount, currency) : '_________________ EUR';
            
            setFont('bold', 9);
            doc.fillColor(textColor)
               .text(`     a) BİRİNCİ TAKSİT: ${firstAmount}`, doc.page.margins.left + 10);
            setFont('regular', 9);
            doc.text('        - İşbu sözleşmenin imzalanması ile birlikte peşin olarak ödenir.', doc.page.margins.left + 10, doc.y, { width: pageWidth - 30 });
            doc.text('        - Bu ödeme, danışmanlık hizmetinin başlangıç bedeli olup, hizmetin fiilen başladığını gösterir.', doc.page.margins.left + 10, doc.y, { width: pageWidth - 30 });
            
            doc.moveDown(0.3);
            
            // Second installment
            const secondAmount = secondInstallment ? formatCurrency(secondInstallment.amount, currency) : '_________________ EUR';
            
            setFont('bold', 9);
            doc.fillColor(textColor)
               .text(`     b) İKİNCİ TAKSİT: ${secondAmount}`, doc.page.margins.left + 10);
            setFont('regular', 9);
            doc.text('        - Öğrencinin hedef üniversitelerden birine kabul alması halinde, kabul mektubunun tesliminden itibaren 7 (yedi) iş günü içinde ödenir.', doc.page.margins.left + 10, doc.y, { width: pageWidth - 30 });
            
            doc.moveDown(0.5);
            
            // 4.3 Payment method
            setFont('bold', 9);
            doc.text('4.3. Ödeme Yöntemi:', doc.page.margins.left + 10);
            setFont('regular', 9);
            doc.text('     - Ödemeler, yukarıda belirtilen IBAN numaralarına havale/EFT yoluyla veya nakit olarak yapılabilir.', doc.page.margins.left + 10, doc.y, { width: pageWidth - 30 });
            doc.text('     - Havale açıklamasına ÖĞRENCİ\'nin adı soyadı yazılmalıdır.', doc.page.margins.left + 10, doc.y, { width: pageWidth - 30 });
            
            doc.moveDown(0.3);
            
            // 4.4 Exchange rate
            setFont('bold', 9);
            doc.text('4.4. Döviz Kuru:', doc.page.margins.left + 10);
            setFont('regular', 9);
            doc.text('     - EUR cinsinden belirlenen ücretler, ödeme günündeki T.C. Merkez Bankası EUR efektif satış kuru üzerinden TL\'ye çevrilebilir.', doc.page.margins.left + 10, doc.y, { width: pageWidth - 30 });
            
            // ============================================================
            // MADDE 5 - İADE POLİTİKASI
            // ============================================================
            
            checkPageSpace(160);
            sectionTitle('MADDE 5 - İADE POLİTİKASI');
            
            subSection('5.1.', 'Birinci Taksit İadesi:');
            bodyText('Birinci taksit, sözleşmenin imzalanması ve hizmetin başlaması ile birlikte İADE EDİLMEZ niteliğindedir. VELİ veya ÖĞRENCİ\'nin herhangi bir sebeple danışmanlık hizmetinden vazgeçmesi halinde, bu tutar verilen hizmetin karşılığı olarak DANIŞMAN\'da kalacaktır.', { indent: 10 });
            
            doc.moveDown(0.3);
            
            subSection('5.2.', 'İkinci Taksit:');
            bodyText('a) ÖĞRENCİ, başvurduğu üniversitelerin hiçbirinden kabul alamaması durumunda ikinci taksit talep edilmez.', { indent: 10 });
            bodyText('b) ÖĞRENCİ kabul aldığı halde kendi isteğiyle eğitimden vazgeçerse, ikinci taksit tam olarak ödenir.', { indent: 10 });
            
            doc.moveDown(0.3);
            
            subSection('5.3.', 'Mücbir Sebepler:');
            bodyText('Savaş, doğal afet, pandemi gibi mücbir sebeplerden kaynaklanan aksaklıklarda taraflar karşılıklı mutabakat ile çözüm arayacaktır.', { indent: 10 });
            
            // ============================================================
            // MADDE 6 - VİZE REDDİ VE SORUMLULUK SINIRI
            // ============================================================
            
            checkPageSpace(160);
            sectionTitle('MADDE 6 - VİZE REDDİ VE SORUMLULUK SINIRI');
            
            const madde6Items = [
                { num: '6.1.', text: 'DANIŞMAN, vize başvuru sürecinde rehberlik ve destek sağlamakla yükümlüdür. Ancak vize başvurusunun kabul veya reddi tamamen ilgili ülkenin konsolosluk/büyükelçiliğinin yetkisindedir.' },
                { num: '6.2.', text: 'Vize reddi halinde DANIŞMAN\'ın herhangi bir sorumluluğu bulunmamaktadır. Vize reddi nedeniyle birinci taksit iadesi yapılmaz.' },
                { num: '6.3.', text: 'Vize reddi durumunda, VELİ/ÖĞRENCİ\'nin talebi halinde DANIŞMAN, ilave ücret talep etmeksizin yeniden başvuru sürecinde destek sağlayacaktır (sadece danışmanlık hizmeti - harç ve masraflar hariç).' },
                { num: '6.4.', text: 'DANIŞMAN, üniversite başvurularının kabul garantisi vermemektedir. Kabul kararı tamamen üniversitelerin yetkisindedir.' }
            ];
            
            for (const item of madde6Items) {
                checkPageSpace(50);
                setFont('bold', 9);
                doc.fillColor(textColor)
                   .text(item.num, doc.page.margins.left + 10, doc.y, { continued: true });
                setFont('regular', 9);
                doc.text(` ${item.text}`, { width: pageWidth - 40, lineGap: 2 });
                doc.moveDown(0.2);
            }
            
            // ============================================================
            // MADDE 7 - TARAFLARIN YÜKÜMLÜLÜKLERİ
            // ============================================================
            
            checkPageSpace(200);
            sectionTitle('MADDE 7 - TARAFLARIN YÜKÜMLÜLÜKLERİ');
            
            subSection('7.1.', 'DANIŞMAN\'ın Yükümlülükleri:');
            doc.moveDown(0.2);
            
            const danismanYukumluluk = [
                'Sözleşme kapsamındaki hizmetleri profesyonel standartlarda ve özenle yerine getirmek',
                'ÖĞRENCİ\'yi başvuru süreçleri hakkında doğru ve güncel bilgilendirmek',
                'Başvuru ve vize süreçlerini aktif olarak takip etmek',
                'Kişisel verileri gizli tutmak ve üçüncü şahıslarla paylaşmamak',
                'İletişim taleplerini makul sürede yanıtlamak'
            ];
            
            const letters = ['a', 'b', 'c', 'd', 'e', 'f'];
            for (let i = 0; i < danismanYukumluluk.length; i++) {
                setFont('regular', 9);
                doc.fillColor(textColor)
                   .text(`     ${letters[i]}) ${danismanYukumluluk[i]}`, doc.page.margins.left + 10, doc.y, { width: pageWidth - 40, lineGap: 1 });
            }
            
            doc.moveDown(0.4);
            checkPageSpace(120);
            
            subSection('7.2.', 'VELİ ve ÖĞRENCİ\'nin Yükümlülükleri:');
            doc.moveDown(0.2);
            
            const veliYukumluluk = [
                'DANIŞMAN\'a doğru, eksiksiz ve güncel bilgi vermek',
                'İstenen belgeleri zamanında ve eksiksiz teslim etmek',
                'Ödeme yükümlülüklerini sözleşmede belirtilen sürelerde yerine getirmek',
                'DANIŞMAN\'ın talep ettiği randevu ve toplantılara katılmak',
                'Başvuru süreçleriyle ilgili e-posta ve mesajları düzenli kontrol etmek',
                'DANIŞMAN\'dan bağımsız olarak üniversite veya konsolosluklarla iletişime geçmeden önce DANIŞMAN\'ı bilgilendirmek'
            ];
            
            for (let i = 0; i < veliYukumluluk.length; i++) {
                setFont('regular', 9);
                doc.fillColor(textColor)
                   .text(`     ${letters[i]}) ${veliYukumluluk[i]}`, doc.page.margins.left + 10, doc.y, { width: pageWidth - 40, lineGap: 1 });
            }
            
            doc.moveDown(0.3);
            
            setFont('bold', 9);
            doc.fillColor(textColor)
               .text('7.3. ', doc.page.margins.left + 10, doc.y, { continued: true });
            setFont('regular', 9);
            doc.text('Yanlış veya eksik bilgi verilmesi nedeniyle doğacak tüm sorumluluk VELİ ve ÖĞRENCİ\'ye aittir.', { width: pageWidth - 40 });
            
            // ============================================================
            // MADDE 8 - GİZLİLİK VE KVKK
            // ============================================================
            
            checkPageSpace(150);
            sectionTitle('MADDE 8 - GİZLİLİK VE KVKK');
            
            const madde8Items = [
                { num: '8.1.', text: 'DANIŞMAN, işbu sözleşme kapsamında edindiği tüm kişisel bilgileri 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") hükümlerine uygun olarak işleyeceğini ve koruyacağını taahhüt eder.' },
                { num: '8.2.', text: 'Kişisel veriler yalnızca aşağıdaki amaçlarla kullanılacaktır:' }
            ];
            
            for (const item of madde8Items) {
                setFont('bold', 9);
                doc.fillColor(textColor)
                   .text(item.num, doc.page.margins.left + 10, doc.y, { continued: true });
                setFont('regular', 9);
                doc.text(` ${item.text}`, { width: pageWidth - 40, lineGap: 2 });
                doc.moveDown(0.1);
            }
            
            bulletPoint('Üniversite başvurularının yapılması', 30);
            bulletPoint('Vize başvuru işlemlerinin yürütülmesi', 30);
            bulletPoint('Konaklama düzenlemelerinin sağlanması', 30);
            bulletPoint('İletişim ve bilgilendirme', 30);
            
            doc.moveDown(0.3);
            
            const madde8Rest = [
                { num: '8.3.', text: 'VELİ ve ÖĞRENCİ, kişisel verilerinin yukarıda belirtilen amaçlarla yurt dışındaki üniversiteler, konsolosluklar ve konaklama sağlayıcıları ile paylaşılmasına açıkça onay vermektedir.' },
                { num: '8.4.', text: 'Taraflar, sözleşme şartlarını ve ücret bilgilerini üçüncü şahıslarla paylaşmamayı kabul eder.' }
            ];
            
            for (const item of madde8Rest) {
                checkPageSpace(40);
                setFont('bold', 9);
                doc.fillColor(textColor)
                   .text(item.num, doc.page.margins.left + 10, doc.y, { continued: true });
                setFont('regular', 9);
                doc.text(` ${item.text}`, { width: pageWidth - 40, lineGap: 2 });
                doc.moveDown(0.2);
            }
            
            // ============================================================
            // MADDE 9 - SÖZLEŞMENİN SÜRESİ VE FESHİ
            // ============================================================
            
            checkPageSpace(100);
            sectionTitle('MADDE 9 - SÖZLEŞMENİN SÜRESİ VE FESHİ');
            
            const madde9Items = [
                { num: '9.1.', text: 'İşbu sözleşme, imza tarihinden itibaren yürürlüğe girer ve ÖĞRENCİ\'nin yurt dışında eğitime başlaması veya başvuru sürecinin sonuçlanması ile sona erer.' },
                { num: '9.2.', text: 'Taraflardan biri, diğer tarafın sözleşme yükümlülüklerini ağır şekilde ihlal etmesi halinde yazılı bildirimle sözleşmeyi feshedebilir.' },
                { num: '9.3.', text: 'Fesih halinde, Madde 5\'teki iade politikası hükümleri uygulanır.' }
            ];
            
            for (const item of madde9Items) {
                setFont('bold', 9);
                doc.fillColor(textColor)
                   .text(item.num, doc.page.margins.left + 10, doc.y, { continued: true });
                setFont('regular', 9);
                doc.text(` ${item.text}`, { width: pageWidth - 40, lineGap: 2 });
                doc.moveDown(0.2);
            }
            
            // ============================================================
            // MADDE 10 - UYUŞMAZLIK VE YETKİLİ MAHKEME
            // ============================================================
            
            checkPageSpace(100);
            sectionTitle('MADDE 10 - UYUŞMAZLIK VE YETKİLİ MAHKEME');
            
            const madde10Items = [
                { num: '10.1.', text: 'İşbu sözleşmeden doğabilecek uyuşmazlıklarda öncelikle taraflar karşılıklı görüşme yoluyla çözüm arayacaktır.' },
                { num: '10.2.', text: 'Uzlaşma sağlanamaması halinde İSTANBUL MAHKEMELERİ ve İCRA DAİRELERİ yetkili olacaktır.' },
                { num: '10.3.', text: 'İşbu sözleşme Türkiye Cumhuriyeti hukukuna tabidir.' }
            ];
            
            for (const item of madde10Items) {
                setFont('bold', 9);
                doc.fillColor(textColor)
                   .text(item.num, doc.page.margins.left + 10, doc.y, { continued: true });
                setFont('regular', 9);
                doc.text(` ${item.text}`, { width: pageWidth - 40, lineGap: 2 });
                doc.moveDown(0.2);
            }
            
            // ============================================================
            // MADDE 11 - DİĞER HÜKÜMLER
            // ============================================================
            
            checkPageSpace(100);
            sectionTitle('MADDE 11 - DİĞER HÜKÜMLER');
            
            const madde11Items = [
                { num: '11.1.', text: 'İşbu sözleşme 11 (on bir) maddeden oluşmakta olup, taraflarca okunmuş, anlaşılmış ve kabul edilmiştir.' },
                { num: '11.2.', text: 'Sözleşmede yapılacak değişiklikler ancak yazılı olarak ve her iki tarafın imzasıyla geçerlilik kazanır.' },
                { num: '11.3.', text: 'Sözleşmenin herhangi bir maddesinin geçersiz sayılması, diğer maddelerin geçerliliğini etkilemez.' },
                { num: '11.4.', text: 'İşbu sözleşme 2 (iki) nüsha olarak düzenlenmiş olup, birer nüsha taraflarda kalacaktır.' }
            ];
            
            for (const item of madde11Items) {
                setFont('bold', 9);
                doc.fillColor(textColor)
                   .text(item.num, doc.page.margins.left + 10, doc.y, { continued: true });
                setFont('regular', 9);
                doc.text(` ${item.text}`, { width: pageWidth - 40, lineGap: 2 });
                doc.moveDown(0.2);
            }
            
            // ============================================================
            // İMZALAR
            // ============================================================
            
            checkPageSpace(200);
            sectionTitle('İMZALAR');
            
            bodyText('İşbu sözleşme, aşağıda belirtilen tarihte taraflarca imzalanarak yürürlüğe girmiştir.');
            doc.moveDown(1);
            
            // Signature columns
            const colWidth = (pageWidth - 30) / 2;
            const leftX = doc.page.margins.left;
            const rightX = doc.page.margins.left + colWidth + 30;
            let sigY = doc.y;
            
            // DANIŞMAN column
            setFont('bold', 10);
            doc.fillColor(primaryColor)
               .text('DANIŞMAN', leftX, sigY, { width: colWidth });
            
            // VELİ column
            doc.text('VELİ / YASAL TEMSİLCİ', rightX, sigY, { width: colWidth });
            
            sigY = doc.y + 5;
            
            // Lines under titles
            doc.moveTo(leftX, sigY)
               .lineTo(leftX + colWidth - 20, sigY)
               .strokeColor(primaryColor)
               .lineWidth(1)
               .stroke();
            
            doc.moveTo(rightX, sigY)
               .lineTo(rightX + colWidth - 20, sigY)
               .strokeColor(primaryColor)
               .lineWidth(1)
               .stroke();
            
            sigY += 10;
            
            setFont('regular', 9);
            doc.fillColor(textColor)
               .text('Venture Global', leftX, sigY, { width: colWidth })
               .text('Yurt Dışı Eğitim Danışmanlık', leftX, doc.y, { width: colWidth });
            
            doc.text('Adı Soyadı:', rightX, sigY, { width: colWidth })
               .text(parentName, rightX, doc.y, { width: colWidth });
            
            const afterNamesY = Math.max(doc.y + 5, sigY + 30);
            
            doc.text('T.C. Kimlik No:', rightX, afterNamesY, { width: colWidth });
            doc.text(parentTc, rightX, doc.y, { width: colWidth });
            
            const signLineY = afterNamesY + 40;
            
            setFont('regular', 9);
            doc.text('İmza: ___________________', leftX, signLineY, { width: colWidth });
            doc.text('İmza: ___________________', rightX, signLineY, { width: colWidth });
            
            const dateLineY = signLineY + 25;
            doc.text(`Tarih: ${today}`, leftX, dateLineY, { width: colWidth });
            doc.text(`Tarih: ${today}`, rightX, dateLineY, { width: colWidth });
            
            doc.y = dateLineY + 30;
            
            // ÖĞRENCİ signature
            doc.moveDown(0.5);
            
            doc.moveTo(doc.page.margins.left, doc.y)
               .lineTo(doc.page.width - doc.page.margins.right, doc.y)
               .strokeColor(lightGray)
               .lineWidth(0.5)
               .stroke();
            
            doc.moveDown(0.5);
            
            setFont('bold', 10);
            doc.fillColor(primaryColor)
               .text('ÖĞRENCİ');
            
            const studentSigLineY = doc.y;
            doc.moveTo(leftX, studentSigLineY)
               .lineTo(leftX + colWidth - 20, studentSigLineY)
               .strokeColor(primaryColor)
               .lineWidth(1)
               .stroke();
            
            doc.moveDown(0.3);
            
            setFont('regular', 9);
            doc.fillColor(textColor);
            labelValue('Adı Soyadı:', studentName, 0);
            labelValue('T.C. Kimlik No:', tcNumber, 0);
            labelValue('Pasaport No:', passportNo, 0);
            
            doc.moveDown(0.5);
            doc.text('İmza: ___________________');
            doc.moveDown(0.3);
            doc.text(`Tarih: ${today}`);
            
            // ============================================================
            // REFERENCE SECTION
            // ============================================================
            
            doc.moveDown(1);
            
            checkPageSpace(100);
            
            doc.moveTo(doc.page.margins.left, doc.y)
               .lineTo(doc.page.width - doc.page.margins.right, doc.y)
               .strokeColor(lightGray)
               .lineWidth(0.5)
               .stroke();
            
            doc.moveDown(0.5);
            
            setFont('bold', 10);
            doc.fillColor(primaryColor)
               .text('ÖĞRENCİ BİLGİLERİ (Referans)', { align: 'center' });
            
            doc.moveDown(0.5);
            
            labelValue('Öğrenci Adı Soyadı:', studentName, 10);
            labelValue('T.C. Kimlik No:', tcNumber, 10);
            labelValue('Hedef Ülke:', targetCountry, 10);
            labelValue('Danışmanlık Ücreti:', totalAmountStr, 10);
            
            // ============================================================
            // EK-1: ÖDEME MAKBUZU
            // ============================================================
            
            checkPageSpace(180);
            sectionTitle('EK-1: ÖDEME MAKBUZU');
            
            doc.moveDown(0.3);
            
            // First installment receipt
            const firstPaid = firstInstallment && firstInstallment.is_paid;
            const firstPayDate = firstInstallment && firstInstallment.payment_date ? formatDate(firstInstallment.payment_date) : '___/___/______';
            const firstAmountReceipt = firstInstallment ? formatCurrency(firstInstallment.amount, currency) : '_____________ EUR/TL';
            
            setFont('regular', 9);
            doc.fillColor(textColor)
               .text(`${firstPaid ? '☑' : '☐'} 1. Taksit Ödendi    Tarih: ${firstPayDate}    Tutar: ${firstAmountReceipt}`);
            doc.text(`  Ödeme Şekli: ☐ Havale/EFT  ☐ Nakit`);
            doc.text(`  Dekont/Makbuz No: _____________________`);
            
            doc.moveDown(0.5);
            
            // Second installment receipt
            const secondPaid = secondInstallment && secondInstallment.is_paid;
            const secondPayDate = secondInstallment && secondInstallment.payment_date ? formatDate(secondInstallment.payment_date) : '___/___/______';
            const secondAmountReceipt = secondInstallment ? formatCurrency(secondInstallment.amount, currency) : '_____________ EUR/TL';
            
            doc.text(`${secondPaid ? '☑' : '☐'} 2. Taksit Ödendi    Tarih: ${secondPayDate}    Tutar: ${secondAmountReceipt}`);
            doc.text(`  Ödeme Şekli: ☐ Havale/EFT  ☐ Nakit`);
            doc.text(`  Dekont/Makbuz No: _____________________`);
            
            doc.moveDown(1);
            
            // Final line
            doc.moveTo(doc.page.margins.left, doc.y)
               .lineTo(doc.page.width - doc.page.margins.right, doc.y)
               .strokeColor(accentColor)
               .lineWidth(1)
               .stroke();
            
            doc.moveDown(0.5);
            
            setFont('regular', 9);
            doc.fillColor('#4a5568')
               .text(`Bu sözleşme ${today} tarihinde İstanbul'da düzenlenmiştir.`, { align: 'center' });
            
            doc.moveDown(0.5);
            
            doc.moveTo(doc.page.margins.left, doc.y)
               .lineTo(doc.page.width - doc.page.margins.right, doc.y)
               .strokeColor(accentColor)
               .lineWidth(1)
               .stroke();
            
            // ============================================================
            // ADD FOOTERS TO ALL PAGES
            // ============================================================
            
            const totalPages = doc.bufferedPageRange().count;
            for (let i = 0; i < totalPages; i++) {
                doc.switchToPage(i);
                drawFooter(i + 1, totalPages);
            }
            
            // Finalize
            doc.end();
            
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    generateContractPDF,
    generateContractNumber,
    formatDate
};


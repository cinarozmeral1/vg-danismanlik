/**
 * Contract PDF Generation Service – Venture Global letterhead
 */
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const FONTS = [path.join(__dirname,'..','public','fonts','DejaVuSans.ttf'),'/usr/share/fonts/dejavu/DejaVuSans.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'];
const FONTS_B = [path.join(__dirname,'..','public','fonts','DejaVuSans-Bold.ttf'),'/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'];
const LOGO = path.join(__dirname,'..','public','fonts','vg-logo-small.png');
function ff(ps){for(const p of ps){try{if(fs.existsSync(p))return p}catch(e){}}return null}
function fd(d){if(!d)return'__ / __ / ____';const x=new Date(d);return`${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()}`}
function fc(a,c='EUR'){if(!a&&a!==0)return'_________';return`${parseFloat(a).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})} ${c}`}
function ntt(n){if(!n&&n!==0)return'_________';n=Math.floor(parseFloat(n));const o=['','Bir','İki','Üç','Dört','Beş','Altı','Yedi','Sekiz','Dokuz'],t=['','On','Yirmi','Otuz','Kırk','Elli','Altmış','Yetmiş','Seksen','Doksan'];if(n===0)return'Sıfır';if(n>=1000){const k=Math.floor(n/1000);let r=(k===1?'':ntt(k))+'Bin';if(n%1000>0)r+=ntt(n%1000);return r}let r='';const h=Math.floor(n/100),te=Math.floor((n%100)/10),on=n%10;if(h>0)r+=(h===1?'':o[h])+'Yüz';if(te>0)r+=t[te];if(on>0)r+=o[on];return r||'Sıfır'}

async function generateContractPDF(data) {
    const {user, applications, services} = data;
    const fp = ff(FONTS), fb = ff(FONTS_B), hl = fs.existsSync(LOGO);

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size:'A4',
                margins:{top:52,bottom:36,left:48,right:48},
                info:{Title:`Sözleşme - ${user.first_name} ${user.last_name}`,Author:'Venture Global'},
                bufferPages:true
            });
            if(fp){doc.registerFont('R',fp);doc.registerFont('B',fb||fp)}else{doc.registerFont('R','Helvetica');doc.registerFont('B','Helvetica-Bold')}

            const ch=[];doc.on('data',c=>ch.push(c));doc.on('end',()=>resolve(Buffer.concat(ch)));doc.on('error',e=>reject(e));

            const today = fd(new Date());
            const sn = `${user.first_name||''} ${user.last_name||''}`.trim()||'_________________________';
            const tc = user.tc_number||'_________________________';
            const bd = fd(user.birth_date);
            const pp = user.passport_number||'_________________________';
            const app = applications&&applications.length>0?applications[0]:null;
            const country = (app&&app.country)||user.desired_country||'_________________________';
            const program = (app&&app.program_name)||'_________________________';
            const bl = '_________________________';

            let svcs = (services||[]).slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
            const s1=svcs[0]||null, s2=svcs[1]||null;
            const cur=(s1&&s1.currency)||'EUR';
            const total=svcs.reduce((s,x)=>s+parseFloat(x.amount||0),0);
            const a1=s1?parseFloat(s1.amount):null, a2=s2?parseFloat(s2.amount):null;
            const p1=s1?s1.is_paid:false, p2=s2?s2.is_paid:false;
            const pd1=s1&&s1.payment_date?fd(s1.payment_date):'__ / __ / ____';
            const pd2=s2&&s2.payment_date?fd(s2.payment_date):'__ / __ / ____';

            const W=doc.page.width-96, ML=48, MR=48;
            const D='#1a365d', T='#1f2937', M='#888';

            function head(){
                if(hl)doc.image(LOGO,ML,10,{width:32});
                doc.font('B').fontSize(10).fillColor(D).text('VENTURE GLOBAL',ML+38,14);
                doc.font('R').fontSize(5.5).fillColor(M).text('YURT DIŞI EĞİTİM DANIŞMANLIĞI',ML+38,26);
                doc.moveTo(ML,35).lineTo(doc.page.width-MR,35).strokeColor(D).lineWidth(0.5).stroke();
            }
            function foot(n,t){
                const y=doc.page.height-26;
                doc.moveTo(ML,y).lineTo(doc.page.width-MR,y).strokeColor('#ddd').lineWidth(0.3).stroke();
                doc.font('R').fontSize(5).fillColor('#aaa');
                doc.text('+90 539 927 30 08 • www.vgdanismanlik.com • Na Větriniku 2513/4 Prag Çekya',ML,y+3,{width:W*0.8});
                doc.text(`${n}/${t}`,ML,y+3,{width:W,align:'right'});
            }
            function sec(t){doc.moveDown(0.15);doc.font('B').fontSize(7.5).fillColor(D).text(t,ML);const y=doc.y;doc.moveTo(ML,y).lineTo(doc.page.width-MR,y).strokeColor(D).lineWidth(0.3).stroke();doc.y=y+2}
            function fl(l,v){doc.font('B').fontSize(6.5).fillColor('#555').text(l,ML+4,doc.y,{continued:true,width:W-8});doc.font('R').fontSize(6.5).fillColor(T).text(' '+v,{width:W-8})}
            function tx(t,i){doc.font('R').fontSize(6.5).fillColor(T).text(t,ML+(i||0),doc.y,{width:W-(i||0),lineGap:0.5})}
            function ni(n,t){doc.font('R').fontSize(6.5).fillColor(T).text(`${n} ${t}`,ML+4,doc.y,{width:W-8,lineGap:0.5})}
            function ck(n){if(doc.y+n>doc.page.height-doc.page.margins.bottom-8){doc.addPage();head();doc.y=42}}

            // ============ PAGE 1 ============
            head(); doc.y=42;
            doc.font('B').fontSize(10).fillColor(D).text('YURT DIŞI EĞİTİM DANIŞMANLIK SÖZLEŞMESİ',{align:'center'});
            doc.moveDown(0.1);
            doc.font('R').fontSize(5.5).fillColor(M);
            const cy=doc.y;
            doc.text(`Sözleşme No: VG-${new Date().getFullYear()}-${String(user.id).padStart(4,'0')}`,ML,cy);
            doc.text(`Tarih: ${today}`,ML,cy,{width:W,align:'right'});
            doc.y+=2;
            doc.moveTo(ML,doc.y).lineTo(doc.page.width-MR,doc.y).strokeColor('#ccc').lineWidth(0.2).stroke();

            // TARAFLAR
            sec('TARAFLAR');
            doc.font('B').fontSize(6.5).fillColor(D).text('1. DANIŞMAN',ML+2);
            fl('Unvan:','Venture Global Yurt Dışı Eğitim Danışmanlık');
            fl('Adres:','İstanbul, Türkiye  |  Telefon: +90 539 927 30 08  |  E-posta: info@vgdanismanlik.com');
            fl('Web:','www.vgdanismanlik.com  |  TL IBAN: TR56 0006 4000 0011 2120 9085 60');
            fl('EUR IBAN:','TR56 0006 4000 0011 2120 9085 60');
            doc.font('R').fontSize(5.5).fillColor(M).text('(Bundan böyle "DANIŞMAN" olarak anılacaktır.)',ML+4);
            doc.moveDown(0.08);

            doc.font('B').fontSize(6.5).fillColor(D).text('2. VELİ / YASAL TEMSİLCİ',ML+2);
            fl('Adı Soyadı:',bl); fl('T.C. Kimlik No:',bl); fl('Adres:',bl); fl('Telefon:',bl); fl('E-posta:',bl);
            doc.font('R').fontSize(5.5).fillColor(M).text('(Bundan böyle "VELİ" olarak anılacaktır.)',ML+4);
            doc.moveDown(0.08);

            doc.font('B').fontSize(6.5).fillColor(D).text('3. ÖĞRENCİ (Hizmetten Faydalanacak Kişi)',ML+2);
            fl('Adı Soyadı:',sn); fl('T.C. Kimlik No:',tc); fl('Doğum Tarihi:',bd); fl('Pasaport No:',pp);
            doc.font('R').fontSize(5.5).fillColor(M).text('(Bundan böyle "ÖĞRENCİ" olarak anılacaktır.)',ML+4);

            // MADDE 1
            ck(40);
            sec('MADDE 1 – SÖZLEŞMENİN KONUSU');
            tx('İşbu sözleşme, DANIŞMAN\'ın ÖĞRENCİ\'ye yurt dışında yükseköğretim eğitimi alabilmesi için danışmanlık hizmeti vermesine ilişkin tarafların karşılıklı hak ve yükümlülüklerini düzenlemektedir.');
            fl('Hedef Ülke:',country); fl('Hedef Program:',program);
            const yr=new Date().getFullYear(); fl('Hedef Dönem:',`${yr}-${yr+1}`);

            // MADDE 2 – COMPACT paragraph style
            ck(50);
            sec('MADDE 2 – DANIŞMANLIK HİZMETLERİ (DAHİL OLAN)');
            tx('DANIŞMAN, işbu sözleşme kapsamında aşağıdaki hizmetleri sunmayı taahhüt eder:');

            // Compact: each service is a short paragraph, not bullets
            const svcText = [
                '2.1. Öğrenci Profili ve İhtiyaç Analizi: Öğrencinin akademik geçmişi, ilgi alanları ve hedeflerine yönelik ayrıntılı analiz ve değerlendirme yapılması.',
                '2.2. Üniversite Seçimi ve Yönlendirme: Öğrencinin profiline uygun üniversite ve programların belirlenmesi; başvuru stratejisinin oluşturulması.',
                '2.3. Başvuru Dosyası Hazırlama: Gerekli belgelerin listelenmesi; motivasyon mektubu yazımında rehberlik; CV hazırlanmasında destek; başvuru formlarının doldurulmasında yardım.',
                '2.4. Başvuru Takibi: Üniversite başvurularının yapılması ve takibi; kabul mektubunun teslim sürecinin takibi.',
                '2.5. Vize Danışmanlığı: Vize başvurusu için gerekli belgelerin hazırlanması; başvuru formunun doldurulmasında yardım; vize randevusu alınmasında destek; sürecin takibi.',
                '2.6. Konaklama Düzenlemeleri: Öğrenci yurdu veya özel konaklama seçeneklerinin araştırılması; rezervasyonda yardım.',
                '2.7. Varış Öncesi Hazırlık: Gidiş öncesi bilgilendirme ve oryantasyon; gerekli eşya ve belge listesi hazırlanması.',
                '2.8. Varış Sonrası Destek (Çek Cumhuriyeti için): Prag Havalimanı\'nda karşılama ve transfer; SIM kart temini; banka hesabı açılması desteği; şehir oryantasyonu.',
                '2.9. Sürekli Destek: Eğitim süreci boyunca 7/24 iletişim hattı; acil durumlarda destek.'
            ];
            for(const s of svcText){ ck(14); ni('',s); }

            // MADDE 3
            ck(50);
            sec('MADDE 3 – DAHİL OLMAYAN HİZMETLER');
            tx('Aşağıdaki masraflar sözleşme kapsamı dışındadır ve VELİ/ÖĞRENCİ tarafından karşılanacaktır:');
            ni('','3.1. Üniversite harç, kayıt ve eğitim ücretleri  |  3.2. Konaklama ücretleri  |  3.3. Uçak bileti ve seyahat masrafları');
            ni('','3.4. Vize başvuru harçları  |  3.5. Sağlık sigortası primleri  |  3.6. Apostil, noter ve tercüme masrafları');
            ni('','3.7. Dil sınavı (IELTS, TOEFL vb.) ücretleri  |  3.8. Günlük yaşam giderleri  |  3.9. Türkiye dışında havalimanı transferi (Çek Cum. Prag hariç)');

            // MADDE 4
            ck(55);
            sec('MADDE 4 – DANIŞMANLIK ÜCRETİ VE ÖDEME KOŞULLARI');
            const ts=total>0?fc(total,cur):'_________ EUR', tt=total>0?ntt(total):'_________';
            const f1=a1?fc(a1,cur):'_________ EUR', f2=a2?fc(a2,cur):'_________ EUR';

            doc.font('B').fontSize(6.5).fillColor(T).text(`4.1. Toplam Danışmanlık Ücreti: ${ts} (Yazıyla: ${tt} Euro)`,ML+4,doc.y,{width:W-8});
            doc.moveDown(0.05);
            doc.font('B').fontSize(6.5).text('4.2. Ödeme Planı:',ML+4);
            doc.font('B').fontSize(6.5).text(`  a) BİRİNCİ TAKSİT: ${f1}`,ML+4,doc.y,{width:W-8});
            doc.font('R').fontSize(6.5).text('     Sözleşmenin imzalanması ile birlikte peşin ödenir. Danışmanlık hizmetinin başlangıç bedeli olup hizmetin fiilen başladığını gösterir.',ML+4,doc.y,{width:W-12,lineGap:0.3});
            doc.font('B').fontSize(6.5).text(`  b) İKİNCİ TAKSİT: ${f2}`,ML+4,doc.y,{width:W-8});
            doc.font('R').fontSize(6.5).text('     Öğrencinin hedef üniversitelerden birine kabul alması halinde, kabul mektubunun tesliminden itibaren 7 iş günü içinde ödenir.',ML+4,doc.y,{width:W-12,lineGap:0.3});
            doc.moveDown(0.05);
            doc.font('B').fontSize(6.5).text('4.3. Ödeme Yöntemi:',ML+4);
            doc.font('R').fontSize(6.5).text('Ödemeler, yukarıda belirtilen IBAN numaralarına havale/EFT yoluyla veya nakit olarak yapılabilir. Havale açıklamasına ÖĞRENCİ\'nin adı soyadı yazılmalıdır.',ML+8,doc.y,{width:W-16,lineGap:0.3});
            doc.font('B').fontSize(6.5).text('4.4. Döviz Kuru:',ML+4);
            doc.font('R').fontSize(6.5).text('EUR cinsinden ücretler, ödeme günündeki T.C. Merkez Bankası EUR efektif satış kuru üzerinden TL\'ye çevrilebilir.',ML+8,doc.y,{width:W-16,lineGap:0.3});

            // MADDE 5
            ck(45);
            sec('MADDE 5 – İADE POLİTİKASI');
            ni('5.1.','Birinci Taksit İadesi: Birinci taksit, sözleşmenin imzalanması ve hizmetin başlaması ile birlikte İADE EDİLMEZ niteliğindedir. VELİ veya ÖĞRENCİ\'nin herhangi bir sebeple vazgeçmesi halinde bu tutar DANIŞMAN\'da kalacaktır.');
            ni('5.2.','İkinci Taksit: a) Hiçbir üniversiteden kabul alınamaması durumunda ikinci taksit talep edilmez. b) Kabul alındığı halde kendi isteğiyle vazgeçilirse ikinci taksit tam olarak ödenir.');
            ni('5.3.','Mücbir Sebepler: Savaş, doğal afet, pandemi gibi mücbir sebeplerden kaynaklanan aksaklıklarda taraflar karşılıklı mutabakat ile çözüm arayacaktır.');

            // MADDE 6
            ck(35);
            sec('MADDE 6 – VİZE REDDİ VE SORUMLULUK SINIRI');
            ni('6.1.','DANIŞMAN, vize başvuru sürecinde rehberlik sağlar. Ancak vize kararı tamamen ilgili ülkenin konsolosluk/büyükelçiliğinin yetkisindedir.');
            ni('6.2.','Vize reddi halinde DANIŞMAN\'ın sorumluluğu bulunmaz. Vize reddi nedeniyle birinci taksit iadesi yapılmaz.');
            ni('6.3.','Vize reddi durumunda, talep halinde DANIŞMAN ilave ücret almaksızın yeniden başvuru sürecinde destek sağlar (harç ve masraflar hariç).');
            ni('6.4.','DANIŞMAN, üniversite kabul garantisi vermemektedir. Kabul kararı tamamen üniversitelerin yetkisindedir.');

            // MADDE 7
            ck(55);
            sec('MADDE 7 – TARAFLARIN YÜKÜMLÜLÜKLERİ');
            ni('7.1.','DANIŞMAN\'ın Yükümlülükleri: a) Hizmetleri profesyonel standartlarda yerine getirmek b) ÖĞRENCİ\'yi doğru ve güncel bilgilendirmek c) Başvuru ve vize süreçlerini aktif takip etmek d) Kişisel verileri gizli tutmak e) İletişim taleplerini makul sürede yanıtlamak.');
            ni('7.2.','VELİ ve ÖĞRENCİ\'nin Yükümlülükleri: a) Doğru, eksiksiz ve güncel bilgi vermek b) Belgeleri zamanında teslim etmek c) Ödeme yükümlülüklerini yerine getirmek d) Randevu ve toplantılara katılmak e) E-posta ve mesajları düzenli kontrol etmek f) Üniversite veya konsolosluklarla iletişime geçmeden önce DANIŞMAN\'ı bilgilendirmek.');
            ni('7.3.','Yanlış veya eksik bilgi verilmesinden doğacak tüm sorumluluk VELİ ve ÖĞRENCİ\'ye aittir.');

            // MADDE 8
            ck(40);
            sec('MADDE 8 – GİZLİLİK VE KVKK');
            ni('8.1.','DANIŞMAN, edindiği tüm kişisel bilgileri 6698 sayılı KVKK hükümlerine uygun olarak işleyeceğini ve koruyacağını taahhüt eder.');
            ni('8.2.','Kişisel veriler yalnızca şu amaçlarla kullanılır: üniversite başvuruları, vize işlemleri, konaklama düzenlemeleri, iletişim ve bilgilendirme.');
            ni('8.3.','VELİ ve ÖĞRENCİ, kişisel verilerinin yukarıdaki amaçlarla yurt dışındaki üniversiteler, konsolosluklar ve konaklama sağlayıcıları ile paylaşılmasına açıkça onay verir.');
            ni('8.4.','Taraflar, sözleşme şartlarını ve ücret bilgilerini üçüncü şahıslarla paylaşmamayı kabul eder.');

            // MADDE 9
            ck(25);
            sec('MADDE 9 – SÖZLEŞMENİN SÜRESİ VE FESHİ');
            ni('9.1.','Sözleşme, imza tarihinden itibaren yürürlüğe girer ve ÖĞRENCİ\'nin yurt dışında eğitime başlaması veya başvuru sürecinin sonuçlanması ile sona erer.');
            ni('9.2.','Taraflardan biri, diğerinin yükümlülüklerini ağır şekilde ihlal etmesi halinde yazılı bildirimle sözleşmeyi feshedebilir.');
            ni('9.3.','Fesih halinde, Madde 5\'teki iade politikası hükümleri uygulanır.');

            // MADDE 10
            ck(20);
            sec('MADDE 10 – UYUŞMAZLIK VE YETKİLİ MAHKEME');
            ni('10.1.','Uyuşmazlıklarda öncelikle taraflar karşılıklı görüşme yoluyla çözüm arayacaktır.');
            ni('10.2.','Uzlaşma sağlanamaması halinde İstanbul Mahkemeleri ve İcra Daireleri yetkili olacaktır.');
            ni('10.3.','İşbu sözleşme Türkiye Cumhuriyeti hukukuna tabidir.');

            // MADDE 11
            ck(20);
            sec('MADDE 11 – DİĞER HÜKÜMLER');
            ni('11.1.','Sözleşme 11 maddeden oluşmakta olup, taraflarca okunmuş, anlaşılmış ve kabul edilmiştir.');
            ni('11.2.','Değişiklikler ancak yazılı olarak ve her iki tarafın imzasıyla geçerlilik kazanır.');
            ni('11.3.','Herhangi bir maddenin geçersiz sayılması, diğer maddelerin geçerliliğini etkilemez.');
            ni('11.4.','Sözleşme 2 nüsha olarak düzenlenmiş olup, birer nüsha taraflarda kalacaktır.');

            // İMZALAR
            ck(110);
            sec('İMZALAR');
            doc.font('R').fontSize(6.5).fillColor(T).text('İşbu sözleşme, aşağıda belirtilen tarihte taraflarca imzalanarak yürürlüğe girmiştir.');
            doc.moveDown(0.2);

            const cw=(W-12)/2, lx=ML, rx=ML+cw+12;
            let sy=doc.y;
            doc.font('B').fontSize(7).fillColor(D);
            doc.text('DANIŞMAN',lx,sy,{width:cw}); doc.text('VELİ / YASAL TEMSİLCİ',rx,sy,{width:cw});
            sy+=9;
            doc.moveTo(lx,sy).lineTo(lx+cw-6,sy).strokeColor(D).lineWidth(0.3).stroke();
            doc.moveTo(rx,sy).lineTo(rx+cw-6,sy).strokeColor(D).lineWidth(0.3).stroke();
            sy+=3;
            doc.font('R').fontSize(6.5).fillColor(T);
            doc.text('Venture Global Yurt Dışı Eğitim Danışmanlık',lx,sy,{width:cw});
            doc.text('Adı Soyadı: '+bl,rx,sy,{width:cw}); doc.text('T.C. Kimlik No: '+bl,rx,doc.y,{width:cw});
            sy=Math.max(doc.y,sy+18)+4;
            doc.text('İmza: ___________________',lx,sy); doc.text('İmza: ___________________',rx,sy);
            sy+=12;
            doc.text('Tarih: '+today,lx,sy); doc.text('Tarih: '+today,rx,sy);
            doc.y=sy+14;

            doc.moveTo(ML,doc.y).lineTo(doc.page.width-MR,doc.y).strokeColor('#ccc').lineWidth(0.2).stroke();
            doc.moveDown(0.15);
            doc.font('B').fontSize(7).fillColor(D).text('ÖĞRENCİ',lx);
            let ssy=doc.y;
            doc.moveTo(lx,ssy).lineTo(lx+cw-6,ssy).strokeColor(D).lineWidth(0.3).stroke();
            doc.y=ssy+3;
            doc.font('R').fontSize(6.5).fillColor(T);
            doc.text('Adı Soyadı: '+sn); doc.text('T.C. Kimlik No: '+tc); doc.text('Pasaport No: '+pp);
            doc.moveDown(0.15);
            doc.text('İmza: ___________________');
            doc.text('Tarih: '+today);

            // EK-1
            ck(50);
            doc.moveDown(0.2);
            sec('EK-1: ÖDEME MAKBUZU');
            doc.font('R').fontSize(6.5).fillColor(T);
            doc.text(`${p1?'☑':'☐'} 1. Taksit Ödendi   Tarih: ${pd1}   Tutar: ${f1}   Ödeme Şekli: ☐ Havale/EFT  ☐ Nakit   Dekont No: ____________`);
            doc.text(`${p2?'☑':'☐'} 2. Taksit Ödendi   Tarih: ${pd2}   Tutar: ${f2}   Ödeme Şekli: ☐ Havale/EFT  ☐ Nakit   Dekont No: ____________`);
            doc.moveDown(0.2);
            doc.moveTo(ML,doc.y).lineTo(doc.page.width-MR,doc.y).strokeColor(D).lineWidth(0.3).stroke();
            doc.moveDown(0.1);
            doc.font('R').fontSize(5.5).fillColor(M).text(`Bu sözleşme ${today} tarihinde İstanbul'da düzenlenmiştir.`,{align:'center'});

            // Footers
            const rng=doc.bufferedPageRange();
            for(let i=0;i<rng.count;i++){doc.switchToPage(i);foot(i+1,rng.count)}

            doc.end();
        }catch(e){reject(e)}
    });
}

function generateContractNumber(userId) {
    return `VG-${new Date().getFullYear()}-${String(userId).padStart(4,'0')}`;
}

module.exports = { generateContractPDF, generateContractNumber, formatDate: fd };

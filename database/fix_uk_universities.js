// İngiltere Üniversiteleri Düzeltme Script
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const updates = [
    {
        name: 'University of Manchester',
        logo_url: 'https://www.manchester.ac.uk/medialibrary/structure/logo.png',
        description: `University of Manchester, 1824 yılında kurulan ve İngiltere'nin en prestijli üniversitelerinden biridir. Russell Group üyesi olan üniversite, dünya sıralamasında sürekli olarak ilk 30 içinde yer almaktadır. 

Üniversite, 25 Nobel ödüllü mezun ve akademisyene ev sahipliği yapmış olup, özellikle mühendislik, tıp, işletme ve sosyal bilimler alanlarında dünya çapında tanınmaktadır. Manchester, grafenin keşfedildiği yer olarak bilim tarihinde önemli bir yere sahiptir.

Kampüs, Manchester şehir merkezinde yer almakta ve öğrencilere son teknoloji laboratuvarlar, modern tesisler, zengin kütüphane kaynakları ve aktif bir öğrenci yaşamı sunmaktadır. 40.000'den fazla öğrencisiyle İngiltere'nin en büyük tek kampüslü üniversitesidir.

Manchester, mezunlarına mükemmel kariyer fırsatları sunmakta olup, mezuniyet sonrası istihdam oranı %95'in üzerindedir. Şehir, öğrenciler için uygun yaşam maliyeti, zengin kültürel yaşam ve güçlü iş bağlantıları sunmaktadır.`
    },
    {
        name: 'University of Westminster',
        logo_url: 'https://www.westminster.ac.uk/sites/default/files/westminster-logo.png',
        description: `University of Westminster, 1838 yılında kurulan ve Londra'nın merkezinde yer alan köklü bir üniversitedir. İngiltere'nin ilk politeknik kurumu olarak tarihe geçen Westminster, bugün özellikle medya, iletişim, mimarlık ve moda alanlarında dünya çapında tanınmaktadır.

BBC'nin kurucusu John Logie Baird, fotoğrafçı Sir Roger Fenton ve birçok ünlü isim Westminster mezunları arasındadır. Üniversite, yaratıcı endüstriler ve medya sektörüyle güçlü bağlara sahiptir.

Regent Street, Marylebone, Cavendish ve Harrow olmak üzere dört farklı kampüste eğitim vermektedir. Merkezi Londra konumu, öğrencilere staj ve iş fırsatları için eşsiz avantajlar sağlamaktadır.

Westminster Scholarship programı, uluslararası öğrencilere tam burs dahil çeşitli burs imkanları sunmaktadır. Üniversite, 160'tan fazla ülkeden gelen öğrencileriyle gerçek anlamda küresel bir topluluktur.`
    },
    {
        name: 'Regent\'s University London',
        logo_url: 'https://www.regents.ac.uk/wp-content/uploads/2023/01/regents-university-london-logo.svg',
        description: `Regent's University London, Londra'nın merkezinde, muhteşem Regent's Park içinde yer alan benzersiz bir özel üniversitedir. 1984 yılında kurulan üniversite, işletme, moda, film, psikoterapi ve liberal sanatlar alanlarında uzmanlaşmıştır.

Küçük sınıf mevcutları (ortalama 15-20 öğrenci) ve kişiselleştirilmiş eğitim yaklaşımıyla öne çıkmaktadır. Öğretim üyeleri, öğrencilerle birebir ilgilenerek akademik ve kariyer gelişimlerini desteklemektedir.

140'tan fazla ülkeden gelen öğrencileriyle gerçek anlamda uluslararası bir ortam sunmaktadır. Kampüste 100'den fazla milliyet temsil edilmekte ve bu çeşitlilik eğitimin önemli bir parçasını oluşturmaktadır.

Londra'nın en güzel parklarından birinde yer alan kampüsü, şehrin kalabalığından uzak huzurlu bir ortamda eğitim görme imkanı sunarken, Oxford Street, West End ve Londra'nın tüm imkanlarına dakikalar içinde ulaşım sağlamaktadır.`
    },
    {
        name: 'University of Winchester',
        logo_url: 'https://www.winchester.ac.uk/media/images/logos/uow-logo.png',
        description: `University of Winchester, 1840 yılında kurulan ve İngiltere'nin en eski eğitim kurumlarından biridir. Winchester şehrinde yer alan üniversite, tarihi atmosferi ve modern eğitim olanaklarını bir arada sunmaktadır.

Eğitim, hukuk, işletme, psikoloji ve yaratıcı sanatlar alanlarında güçlü programlara sahiptir. Özellikle öğretmen yetiştirme programları İngiltere'de en yüksek puanlar arasında yer almaktadır.

Küçük ve samimi kampüs ortamı, öğrencilere kişiselleştirilmiş destek ve güçlü bir topluluk hissi sunmaktadır. Öğrenci memnuniyeti anketlerinde sürekli olarak yüksek puanlar almaktadır.

Winchester, İngiltere'nin eski başkenti olup, zengin tarihi, güvenli ortamı ve yüksek yaşam kalitesiyle bilinmektedir. Londra'ya sadece bir saat mesafede olan şehir, hem sakin bir öğrencilik deneyimi hem de başkentin tüm imkanlarına kolay erişim sunmaktadır.`
    },
    {
        name: 'Cardiff University',
        logo_url: 'https://www.cardiff.ac.uk/__data/assets/image/0005/1589450/cardiff-university-logo.png',
        description: `Cardiff University, 1883 yılında kurulan ve Galler'in başkenti Cardiff'te yer alan prestijli bir araştırma üniversitesidir. Russell Group üyesi olan üniversite, İngiltere'nin en seçkin araştırma üniversiteleri arasında yer almaktadır.

Özellikle tıp, mühendislik, mimarlık, gazetecilik ve iletişim alanlarında dünya çapında tanınmaktadır. Gazetecilik okulu, dünyada en iyi 5 içinde gösterilmektedir.

Modern kampüsü, Cardiff şehir merkezinde yer almakta ve öğrencilere son teknoloji laboratuvarlar, kütüphaneler ve spor tesisleri sunmaktadır. Cathays Park kampüsü, İngiltere'nin en güzel üniversite kampüslerinden biri olarak kabul edilmektedir.

200'den fazla ülkeden gelen 33.000'i aşkın öğrencisiyle çok kültürlü bir ortam sağlamaktadır. Cardiff, İngiltere'nin en uygun yaşam maliyetine sahip başkentlerinden biri olup, öğrenciler için ideal bir şehirdir.`
    },
    {
        name: 'London School of Economics and Political Science (LSE)',
        logo_url: 'https://www.lse.ac.uk/lse-information/assets/images/lse-logo.png',
        description: `London School of Economics and Political Science (LSE), 1895 yılında kurulan ve sosyal bilimler alanında dünyanın en önde gelen üniversitesidir. Russell Group ve G5 üyesi olan LSE, ekonomi, siyaset bilimi, hukuk, sosyoloji ve uluslararası ilişkiler alanlarında tartışmasız dünya lideridir.

18 Nobel ödüllü mezun ve akademisyene sahip olan LSE, 55'ten fazla devlet başkanı, başbakan ve dünya lideri yetiştirmiştir. George Soros, David Rockefeller, Mick Jagger ve JFK gibi isimler LSE mezunlarıdır.

Londra'nın kalbinde, Holborn'da yer alan kampüsü, öğrencilere Parlamentoya, Londra finans merkezine ve uluslararası kuruluşlara dakikalar içinde erişim imkanı sunmaktadır.

Mezunları dünyanın en yüksek maaş alan profesyonelleri arasında yer almaktadır. LSE, dünya liderlerini, iş dünyası yöneticilerini, akademisyenleri ve aktivistleri yetiştiren seçkin bir kurumdur. Kabul oranı sadece %8 civarındadır.`
    },
    {
        name: 'University of Edinburgh',
        logo_url: 'https://www.ed.ac.uk/sites/default/files/atoms/files/uoe-logo.png',
        description: `University of Edinburgh, 1582 yılında kurulan ve dünyanın en eski, en prestijli üniversitelerinden biridir. Russell Group üyesi olan Edinburgh, dünya sıralamasında sürekli ilk 20 içinde yer almaktadır.

Tıp, hukuk, mühendislik, felsefe, edebiyat ve yapay zeka alanlarında dünya çapında liderdir. Charles Darwin, David Hume, Alexander Graham Bell, Arthur Conan Doyle ve J.K. Rowling gibi tarihi isimlerin yetiştiği bu köklü kurumdur.

İskoçya'nın başkentinde yer alan tarihi kampüsü, UNESCO Dünya Mirası listesindeki şehirle bütünleşmiş durumdadır. Old College ve New College binalarıyla Harry Potter'a ilham veren atmosferi yaşatmaktadır.

Her yıl dünya genelinden 45.000'den fazla öğrenciyi ağırlayan Edinburgh, İskoçya'nın en kozmopolit şehirinde eşsiz bir öğrencilik deneyimi sunmaktadır. Edinburgh Festivali döneminde şehir, dünyanın sanat ve kültür başkentine dönüşmektedir.`
    },
    {
        name: 'King\'s College London',
        logo_url: 'https://www.kcl.ac.uk/newsite/media/images/brand/kcl-logo.svg',
        description: `King's College London, 1829 yılında kurulan ve İngiltere'nin en eski, en prestijli üniversitelerinden biridir. Russell Group ve Golden Triangle üyesi olan King's, dünya sıralamasında sürekli ilk 40 içinde yer almaktadır.

Özellikle tıp, hukuk, uluslararası ilişkiler, savaş çalışmaları ve beşeri bilimler alanlarında dünya çapında tanınmaktadır. Florence Nightingale hemşirelik okulunu burada kurmuştur.

14 Nobel ödüllü mezun ve akademisyene sahiptir. DNA'nın yapısının keşfi bu üniversitede gerçekleşmiştir. Desmond Tutu, Virginia Woolf ve Thomas Hardy King's mezunlarıdır.

Londra'nın merkezinde, Strand, Waterloo, Guy's, St Thomas' ve Denmark Hill olmak üzere beş kampüste eğitim vermektedir. Thames Nehri kıyısında, Parlamento'ya yürüme mesafesinde yer alan ana kampüsü eşsiz bir konum sunmaktadır.`
    },
    {
        name: 'University of Sussex',
        logo_url: 'https://www.sussex.ac.uk/brand/assets/images/university-of-sussex-logo.svg',
        description: `University of Sussex, 1961 yılında kurulan ve İngiltere'nin önde gelen araştırma üniversitelerinden biridir. Kuruluşundan bu yana yenilikçi ve disiplinlerarası yaklaşımıyla tanınmaktadır.

Brighton yakınlarında, South Downs Milli Parkı içinde yer alan kampüsü, doğa ile iç içe benzersiz bir öğrencilik deneyimi sunmaktadır. Sir Basil Spence tarafından tasarlanan modernist kampüs, İngiltere'nin mimari açıdan en önemli üniversite kampüslerinden biridir.

Özellikle kalkınma çalışmaları (dünyada 1. sırada), uluslararası ilişkiler, psikoloji, medya ve yapay zeka alanlarında dünya çapında tanınmaktadır. 5 Nobel ödüllü akademisyene ev sahipliği yapmıştır.

Londra'ya sadece bir saat mesafede olan Sussex, canlı ve yaratıcı Brighton şehrinin tüm olanaklarını öğrencilerine sunmaktadır. Brighton, İngiltere'nin en LGBTQ+ dostu ve en liberal şehri olarak bilinmektedir.`
    }
];

async function fix() {
    console.log('🔧 İngiltere Üniversiteleri Düzeltiliyor...\n');
    
    try {
        for (const uni of updates) {
            console.log(`📝 Güncelleniyor: ${uni.name}`);
            
            await pool.query(`
                UPDATE universities 
                SET logo_url = $1, 
                    description = $2,
                    is_featured = false,
                    updated_at = CURRENT_TIMESTAMP
                WHERE name = $3 AND country = 'UK'
            `, [uni.logo_url, uni.description, uni.name]);
            
            console.log('   ✅ Güncellendi\n');
        }
        
        console.log('✅ Tüm güncellemeler tamamlandı!');
        
    } catch (error) {
        console.error('❌ Hata:', error);
    } finally {
        await pool.end();
    }
}

fix();























// İngiltere Üniversiteleri Migration Script
// Bu script UK üniversitelerini ve bölümlerini ekler

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

// Üniversite verileri
const universities = [
    {
        name: 'University of Manchester',
        city: 'Manchester',
        logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/University_of_Manchester_logo.svg/1200px-University_of_Manchester_logo.svg.png',
        world_ranking: 27,
        description: 'University of Manchester, 1824 yılında kurulan ve İngiltere\'nin en prestijli üniversitelerinden biridir. Russell Group üyesi olan üniversite, dünya sıralamasında ilk 30 içinde yer almaktadır. 25 Nobel ödüllü mezun ve akademisyene ev sahipliği yapmış olan Manchester, özellikle mühendislik, tıp, işletme ve sosyal bilimler alanlarında dünya çapında tanınmaktadır. Kampüs, Manchester şehir merkezinde yer almakta ve öğrencilere modern tesisler, zengin kütüphane kaynakları ve aktif bir öğrenci yaşamı sunmaktadır.',
        is_featured: true,
        departments: [
            { name_tr: 'İşletme', name_en: 'Business Administration', price: 24000 },
            { name_tr: 'Bilgisayar Mühendisliği', name_en: 'Computer Science', price: 27500 },
            { name_tr: 'Elektrik ve Elektronik Mühendisliği', name_en: 'Electrical and Electronic Engineering', price: 27500 },
            { name_tr: 'Makine Mühendisliği', name_en: 'Mechanical Engineering', price: 27500 },
            { name_tr: 'Tıp', name_en: 'Medicine', price: 47000 },
            { name_tr: 'Hukuk', name_en: 'Law', price: 23000 },
            { name_tr: 'Ekonomi', name_en: 'Economics', price: 23000 },
            { name_tr: 'Psikoloji', name_en: 'Psychology', price: 23000 },
            { name_tr: 'Mimarlık', name_en: 'Architecture', price: 25000 }
        ]
    },
    {
        name: 'University of Westminster',
        city: 'London',
        logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/University_of_Westminster_logo.svg/1200px-University_of_Westminster_logo.svg.png',
        world_ranking: null,
        description: 'University of Westminster, 1838 yılında kurulan ve Londra\'nın merkezinde yer alan köklü bir üniversitedir. Özellikle medya, iletişim, mimarlık ve moda alanlarında dünya çapında tanınmaktadır. BBC\'nin kurucusu John Logie Baird dahil olmak üzere birçok ünlü mezuna sahiptir. Regent Street, Marylebone, Cavendish ve Harrow olmak üzere dört farklı kampüste eğitim vermektedir. Uluslararası öğrenciler için çeşitli burs imkanları sunmaktadır.',
        is_featured: false,
        departments: [
            { name_tr: 'Moda Tasarımı', name_en: 'Fashion Design', price: 15500 },
            { name_tr: 'Medya ve İletişim', name_en: 'Media and Communications', price: 15500 },
            { name_tr: 'Mimarlık', name_en: 'Architecture', price: 15500 },
            { name_tr: 'Film ve Televizyon', name_en: 'Film and Television', price: 15500 },
            { name_tr: 'İşletme', name_en: 'Business Management', price: 15500 },
            { name_tr: 'Bilgisayar Bilimleri', name_en: 'Computer Science', price: 15500 },
            { name_tr: 'Hukuk', name_en: 'Law', price: 15500 },
            { name_tr: 'Psikoloji', name_en: 'Psychology', price: 15500 }
        ]
    },
    {
        name: 'Regent\'s University London',
        city: 'London',
        logo_url: 'https://www.regents.ac.uk/wp-content/uploads/2021/03/regents-logo.png',
        world_ranking: null,
        description: 'Regent\'s University London, Londra\'nın merkezinde, Regent\'s Park içinde yer alan özel bir üniversitedir. 1984 yılında kurulan üniversite, işletme, moda, film, psikoterapi ve liberal sanatlar alanlarında uzmanlaşmıştır. Küçük sınıf mevcutları ve kişiselleştirilmiş eğitim yaklaşımıyla öne çıkmaktadır. 140\'tan fazla ülkeden gelen öğrencileriyle gerçek anlamda uluslararası bir ortam sunmaktadır. Londra\'nın en güzel parklarından birinde yer alan kampüsü, benzersiz bir öğrencilik deneyimi sağlamaktadır.',
        is_featured: false,
        departments: [
            { name_tr: 'İşletme', name_en: 'Business', price: 19500 },
            { name_tr: 'Moda ve Tasarım', name_en: 'Fashion and Design', price: 19500 },
            { name_tr: 'Film ve Medya', name_en: 'Film and Media', price: 19500 },
            { name_tr: 'Psikoterapi', name_en: 'Psychotherapy', price: 19500 },
            { name_tr: 'Uluslararası İlişkiler', name_en: 'International Relations', price: 19500 },
            { name_tr: 'Liberal Sanatlar', name_en: 'Liberal Arts', price: 19500 }
        ]
    },
    {
        name: 'University of Winchester',
        city: 'Winchester',
        logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d2/University_of_Winchester_logo.svg/1200px-University_of_Winchester_logo.svg.png',
        world_ranking: null,
        description: 'University of Winchester, 1840 yılında kurulan ve İngiltere\'nin en eski eğitim kurumlarından biridir. Winchester şehrinde yer alan üniversite, tarihi atmosferi ve modern eğitim olanaklarını bir arada sunmaktadır. Eğitim, hukuk, işletme, psikoloji ve yaratıcı sanatlar alanlarında güçlü programlara sahiptir. Küçük ve samimi kampüs ortamı, öğrencilere kişiselleştirilmiş destek ve güçlü bir topluluk hissi sunmaktadır. Londra\'ya sadece bir saat mesafededir.',
        is_featured: false,
        departments: [
            { name_tr: 'Eğitim', name_en: 'Education', price: 14700 },
            { name_tr: 'Hukuk', name_en: 'Law', price: 14700 },
            { name_tr: 'İşletme', name_en: 'Business Management', price: 14700 },
            { name_tr: 'Psikoloji', name_en: 'Psychology', price: 14700 },
            { name_tr: 'Yaratıcı Yazarlık', name_en: 'Creative Writing', price: 14700 },
            { name_tr: 'Spor Yönetimi', name_en: 'Sports Management', price: 14700 },
            { name_tr: 'Tarih', name_en: 'History', price: 14700 }
        ]
    },
    {
        name: 'Cardiff University',
        city: 'Cardiff',
        logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e5/Cardiff_University_logo.svg/1200px-Cardiff_University_logo.svg.png',
        world_ranking: 154,
        description: 'Cardiff University, 1883 yılında kurulan ve Galler\'in başkenti Cardiff\'te yer alan prestijli bir araştırma üniversitesidir. Russell Group üyesi olan üniversite, özellikle tıp, mühendislik, mimarlık ve gazetecilik alanlarında dünya çapında tanınmaktadır. Modern kampüsü, şehir merkezinde yer almakta ve öğrencilere mükemmel tesisler sunmaktadır. 200\'den fazla ülkeden gelen uluslararası öğrenci topluluğuyla çok kültürlü bir ortam sağlamaktadır.',
        is_featured: true,
        departments: [
            { name_tr: 'Tıp', name_en: 'Medicine', price: 39450 },
            { name_tr: 'Mimarlık', name_en: 'Architecture', price: 23450 },
            { name_tr: 'Gazetecilik', name_en: 'Journalism', price: 20450 },
            { name_tr: 'Mühendislik', name_en: 'Engineering', price: 25450 },
            { name_tr: 'Hukuk', name_en: 'Law', price: 20450 },
            { name_tr: 'İşletme', name_en: 'Business', price: 20450 },
            { name_tr: 'Psikoloji', name_en: 'Psychology', price: 20450 },
            { name_tr: 'Bilgisayar Bilimleri', name_en: 'Computer Science', price: 25450 }
        ]
    },
    {
        name: 'London School of Economics and Political Science (LSE)',
        city: 'London',
        logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/London_School_of_Economics_logo.svg/1200px-London_School_of_Economics_logo.svg.png',
        world_ranking: 45,
        description: 'London School of Economics and Political Science (LSE), 1895 yılında kurulan ve sosyal bilimler alanında dünyanın en önde gelen üniversitelerinden biridir. Russell Group ve G5 üyesi olan LSE, ekonomi, siyaset bilimi, hukuk, sosyoloji ve uluslararası ilişkiler alanlarında dünya lideridir. 18 Nobel ödüllü mezun ve akademisyene sahiptir. Londra\'nın kalbinde, Holborn\'da yer alan kampüsü, öğrencilere eşsiz kariyer fırsatları sunmaktadır. Dünya liderlerini, iş dünyası yöneticilerini ve akademisyenleri yetiştiren seçkin bir kurumdur.',
        is_featured: true,
        departments: [
            { name_tr: 'Ekonomi', name_en: 'Economics', price: 25272 },
            { name_tr: 'Siyaset Bilimi', name_en: 'Political Science', price: 25272 },
            { name_tr: 'Hukuk', name_en: 'Law', price: 25272 },
            { name_tr: 'Uluslararası İlişkiler', name_en: 'International Relations', price: 25272 },
            { name_tr: 'Sosyoloji', name_en: 'Sociology', price: 25272 },
            { name_tr: 'Finans', name_en: 'Finance', price: 25272 },
            { name_tr: 'İşletme', name_en: 'Management', price: 25272 },
            { name_tr: 'Felsefe', name_en: 'Philosophy', price: 25272 }
        ]
    },
    {
        name: 'University of Edinburgh',
        city: 'Edinburgh',
        logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0e/University_of_Edinburgh_logo.svg/1200px-University_of_Edinburgh_logo.svg.png',
        world_ranking: 15,
        description: 'University of Edinburgh, 1582 yılında kurulan ve dünyanın en eski ve en prestijli üniversitelerinden biridir. Russell Group üyesi olan Edinburgh, tıp, hukuk, mühendislik, felsefe ve yapay zeka alanlarında dünya çapında liderdir. İskoçya\'nın başkentinde yer alan tarihi kampüsü, UNESCO Dünya Mirası listesindeki şehirle bütünleşmiş durumdadır. Darwin, Hume, Alexander Graham Bell gibi tarihi isimlerin yetiştiği bu köklü kurum, her yıl dünya genelinden binlerce öğrenciyi ağırlamaktadır.',
        is_featured: true,
        departments: [
            { name_tr: 'Tıp', name_en: 'Medicine', price: 35900 },
            { name_tr: 'Hukuk', name_en: 'Law', price: 24500 },
            { name_tr: 'Bilgisayar Bilimleri', name_en: 'Computer Science', price: 31900 },
            { name_tr: 'Yapay Zeka', name_en: 'Artificial Intelligence', price: 31900 },
            { name_tr: 'Felsefe', name_en: 'Philosophy', price: 24500 },
            { name_tr: 'Mühendislik', name_en: 'Engineering', price: 31900 },
            { name_tr: 'İşletme', name_en: 'Business', price: 24500 },
            { name_tr: 'Veterinerlik', name_en: 'Veterinary Medicine', price: 35900 }
        ]
    },
    {
        name: 'King\'s College London',
        city: 'London',
        logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e7/King%27s_College_London_logo.svg/1200px-King%27s_College_London_logo.svg.png',
        world_ranking: 37,
        description: 'King\'s College London, 1829 yılında kurulan ve İngiltere\'nin en eski üniversitelerinden biridir. Russell Group ve Golden Triangle üyesi olan King\'s, özellikle tıp, hukuk, uluslararası ilişkiler ve beşeri bilimler alanlarında dünya çapında tanınmaktadır. 14 Nobel ödüllü mezun ve akademisyene sahiptir. Londra\'nın merkezinde, Strand, Waterloo ve Guy\'s kampüslerinde eğitim vermektedir. Dünya sıralamasında sürekli ilk 40 içinde yer alan prestijli bir araştırma üniversitesidir.',
        is_featured: true,
        departments: [
            { name_tr: 'Tıp', name_en: 'Medicine', price: 43000 },
            { name_tr: 'Hukuk', name_en: 'Law', price: 24550 },
            { name_tr: 'Uluslararası İlişkiler', name_en: 'International Relations', price: 24550 },
            { name_tr: 'Diş Hekimliği', name_en: 'Dentistry', price: 43000 },
            { name_tr: 'Hemşirelik', name_en: 'Nursing', price: 24550 },
            { name_tr: 'Psikoloji', name_en: 'Psychology', price: 24550 },
            { name_tr: 'İşletme', name_en: 'Business Management', price: 24550 },
            { name_tr: 'Bilgisayar Bilimleri', name_en: 'Computer Science', price: 30300 }
        ]
    },
    {
        name: 'University of Sussex',
        city: 'Brighton',
        logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/3f/University_of_Sussex_Logo.svg/1200px-University_of_Sussex_Logo.svg.png',
        world_ranking: 139,
        description: 'University of Sussex, 1961 yılında kurulan ve İngiltere\'nin önde gelen araştırma üniversitelerinden biridir. Brighton yakınlarında, South Downs Milli Parkı içinde yer alan kampüsü, doğa ile iç içe benzersiz bir öğrencilik deneyimi sunmaktadır. Özellikle kalkınma çalışmaları, uluslararası ilişkiler, psikoloji ve medya alanlarında dünya çapında tanınmaktadır. 5 Nobel ödüllü akademisyene ev sahipliği yapmıştır. Londra\'ya sadece bir saat mesafede olan Sussex, canlı Brighton şehrinin tüm olanaklarını öğrencilerine sunmaktadır.',
        is_featured: false,
        departments: [
            { name_tr: 'Kalkınma Çalışmaları', name_en: 'Development Studies', price: 19500 },
            { name_tr: 'Uluslararası İlişkiler', name_en: 'International Relations', price: 19500 },
            { name_tr: 'Psikoloji', name_en: 'Psychology', price: 22500 },
            { name_tr: 'Medya ve İletişim', name_en: 'Media and Communications', price: 19500 },
            { name_tr: 'İşletme', name_en: 'Business', price: 19500 },
            { name_tr: 'Bilgisayar Bilimleri', name_en: 'Computer Science', price: 22500 },
            { name_tr: 'Mühendislik', name_en: 'Engineering', price: 22500 }
        ]
    }
];

async function migrate() {
    console.log('🚀 İngiltere Üniversiteleri Migration Başlıyor...\n');
    
    try {
        // 1. Önce mevcut UK üniversitelerinin bölümlerini sil
        console.log('🗑️  Mevcut UK bölümleri siliniyor...');
        await pool.query(`
            DELETE FROM university_departments 
            WHERE university_id IN (SELECT id FROM universities WHERE country = 'UK')
        `);
        
        // 2. Mevcut UK üniversitelerini sil
        console.log('🗑️  Mevcut UK üniversiteleri siliniyor...');
        const deleteResult = await pool.query(`DELETE FROM universities WHERE country = 'UK' RETURNING id`);
        console.log(`   Silinen üniversite sayısı: ${deleteResult.rowCount}\n`);
        
        // 3. Yeni üniversiteleri ekle
        for (const uni of universities) {
            console.log(`📚 Ekleniyor: ${uni.name}`);
            
            // Üniversiteyi ekle
            const uniResult = await pool.query(`
                INSERT INTO universities (
                    name, country, city, logo_url, world_ranking, 
                    description, requirements, is_active, is_featured,
                    created_at, updated_at
                ) VALUES ($1, 'UK', $2, $3, $4, $5, NULL, true, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id
            `, [uni.name, uni.city, uni.logo_url, uni.world_ranking, uni.description, uni.is_featured]);
            
            const universityId = uniResult.rows[0].id;
            console.log(`   ✅ Üniversite eklendi (ID: ${universityId})`);
            
            // Bölümleri ekle
            for (const dept of uni.departments) {
                await pool.query(`
                    INSERT INTO university_departments (
                        university_id, name_tr, name_en, price, currency, is_active
                    ) VALUES ($1, $2, $3, $4, 'GBP', true)
                `, [universityId, dept.name_tr, dept.name_en, dept.price]);
            }
            console.log(`   ✅ ${uni.departments.length} bölüm eklendi\n`);
        }
        
        console.log('✅ Migration tamamlandı!');
        console.log(`   Toplam ${universities.length} üniversite eklendi`);
        
        // İstatistikleri göster
        const stats = await pool.query(`
            SELECT u.name, COUNT(d.id) as dept_count 
            FROM universities u 
            LEFT JOIN university_departments d ON u.id = d.university_id 
            WHERE u.country = 'UK' 
            GROUP BY u.id, u.name 
            ORDER BY u.name
        `);
        
        console.log('\n📊 Eklenen Üniversiteler:');
        stats.rows.forEach(row => {
            console.log(`   - ${row.name}: ${row.dept_count} bölüm`);
        });
        
    } catch (error) {
        console.error('❌ Migration hatası:', error);
    } finally {
        await pool.end();
    }
}

migrate();



















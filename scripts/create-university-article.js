require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

async function createUniversityArticle() {
    try {
        // Bir üniversite seç
        const uniResult = await pool.query(`
            SELECT id, name, country, city FROM universities 
            WHERE is_active = true 
            ORDER BY RANDOM() 
            LIMIT 1
        `);
        
        if (uniResult.rows.length === 0) {
            console.log('❌ Üniversite bulunamadı');
            process.exit(1);
        }
        
        const uni = uniResult.rows[0];
        console.log('🏛️ Seçilen üniversite:', uni.name, '(' + uni.city + ', ' + uni.country + ')');
        console.log('');
        
        // Makale oluştur
        console.log('🤖 Yapay zeka üniversite makalesi yazıyor...');
        
        const prompt = `Konu: ${uni.name} Üniversitesinde Öğrenci Olmak
Ülke: ${uni.country}
Şehir: ${uni.city}

Bu üniversite hakkında Türkçe bir blog makalesi yaz.

Makale şunları içermeli:
- Üniversitenin tanıtımı
- Kampüs ve öğrenci hayatı
- Başvuru süreci
- Neden bu üniversite tercih edilmeli
- Venture Global ismini 3-4 kez doğal şekilde kullan
- Son paragrafta Venture Global ile iletişime geçebilirsiniz

SADECE HTML formatında yaz. JSON veya kod bloğu EKLEME.`;

        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + process.env.GROQ_API_KEY
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: 'Sen Venture Global için blog yazarısın. Düz HTML formatında yaz.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 4000
            })
        });
        
        const data = await response.json();
        let content = data.choices?.[0]?.message?.content || '';
        
        // Temizle
        content = content.replace(/```html\s*/gi, '').replace(/```/g, '').trim();
        
        // Excerpt oluştur
        const excerpt = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200) + '...';
        
        // Slug oluştur
        const slug = (uni.name.toLowerCase()
            .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
            .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')) + '-' + Date.now().toString(36);
        
        // Görsel seç
        const images = {
            'Germany': 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=800&q=80',
            'Italy': 'https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?w=800&q=80',
            'Czech Republic': 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=800&q=80',
            'Austria': 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=800&q=80',
            'Hungary': 'https://images.unsplash.com/photo-1551867633-194f125bddfa?w=800&q=80',
            'Poland': 'https://images.unsplash.com/photo-1607427293702-036707e709cd?w=800&q=80',
            'UK': 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80'
        };
        const imageUrl = images[uni.country] || 'https://images.unsplash.com/photo-1562774053-701939374585?w=800&q=80';
        
        // Kaydet
        const result = await pool.query(`
            INSERT INTO blog_posts (
                title_tr, title_en, slug, content_tr, content_en,
                excerpt_tr, excerpt_en, meta_description_tr, meta_description_en,
                keywords, topic_type, related_university_id, related_country,
                featured_image_url, is_published, published_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, NOW())
            RETURNING *
        `, [
            uni.name + ' Üniversitesinde Öğrenci Olmak: 2025 Rehberi',
            'Studying at ' + uni.name + ': 2025 Guide',
            slug,
            content,
            content,
            excerpt,
            excerpt,
            uni.name + ' hakkında detaylı bilgi. Venture Global ile yurtdışı eğitim.',
            'Learn about ' + uni.name + ' with Venture Global.',
            'Venture Global, ' + uni.name + ', ' + uni.country + ', yurtdışı eğitim',
            'university',
            uni.id,
            uni.country,
            imageUrl
        ]);
        
        console.log('✅ Makale oluşturuldu!');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📝 Başlık:', result.rows[0].title_tr);
        console.log('🏷️  Kategori: 🏛️ Üniversite');
        console.log('🔗 URL: /blog/' + result.rows[0].slug);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Tüm kategorileri göster
        const stats = await pool.query(`
            SELECT topic_type, COUNT(*) as count 
            FROM blog_posts 
            GROUP BY topic_type 
            ORDER BY count DESC
        `);
        
        console.log('');
        console.log('📊 KATEGORİ DAĞILIMI:');
        stats.rows.forEach(r => {
            const icon = r.topic_type === 'university' ? '🏛️' :
                         r.topic_type === 'country' ? '🌍' :
                         r.topic_type === 'country_program' ? '📚' :
                         r.topic_type === 'cost' ? '💰' : '📄';
            console.log('   ' + icon + ' ' + r.topic_type + ': ' + r.count + ' makale');
        });
        
    } catch (error) {
        console.error('❌ Hata:', error.message);
    }
    
    process.exit(0);
}

createUniversityArticle();


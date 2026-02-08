// Test kullanıcılarını silme scripti

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Silinecek test kullanıcılarının email adresleri
const testEmails = [
    'mehmet.yilmaz@test.com',
    'ayse.demir@test.com',
    'mustafa.kaya@test.com',
    'fatma.celik@test.com',
    'ali.sahin@test.com'
];

async function deleteTestUsers() {
    console.log('🗑️  Test kullanıcıları siliniyor...\n');
    
    for (const email of testEmails) {
        try {
            const result = await pool.query(
                'DELETE FROM users WHERE email = $1 RETURNING id, first_name, last_name, email',
                [email]
            );
            
            if (result.rows.length > 0) {
                const user = result.rows[0];
                console.log(`✅ ${user.first_name} ${user.last_name} (${user.email}) silindi`);
            } else {
                console.log(`⚠️  ${email} bulunamadı`);
            }
        } catch (error) {
            console.error(`❌ ${email} silinirken hata:`, error.message);
        }
    }
    
    console.log('\n✅ Tamamlandı!');
    await pool.end();
}

deleteTestUsers();






















const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://neondb_owner:npg_Sd7p4ULFtBmx@ep-snowy-sound-ad15kvuj-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Vize başvuruları migration başlatılıyor...\n');
        
        // SQL dosyasını oku
        const sqlPath = path.join(__dirname, 'add_visa_applications.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // SQL komutlarını çalıştır
        await client.query(sql);
        
        console.log('✅ visa_applications tablosu oluşturuldu');
        console.log('✅ visa_appointments tablosu oluşturuldu');
        console.log('✅ Indexler oluşturuldu');
        console.log('✅ Trigger\'lar oluşturuldu');
        
        console.log('\n🎉 Migration başarıyla tamamlandı!');
        
    } catch (error) {
        console.error('❌ Migration hatası:', error.message);
        
        // Eğer trigger zaten varsa, sadece uyarı ver
        if (error.message.includes('already exists')) {
            console.log('⚠️  Bazı objeler zaten mevcut, devam ediliyor...');
        }
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();


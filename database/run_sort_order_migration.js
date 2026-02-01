// Sort Order Migration - Bölüm sıralama için
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    console.log('🚀 Sort Order Migration başlıyor...\n');
    
    try {
        // 1. sort_order alanını ekle
        console.log('1️⃣  sort_order alanı ekleniyor...');
        await pool.query(`
            ALTER TABLE university_departments 
            ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0
        `);
        console.log('   ✅ sort_order alanı eklendi\n');

        // 2. Mevcut bölümlere sıra numarası ata
        console.log('2️⃣  Mevcut bölümlere sıra numarası atanıyor...');
        await pool.query(`
            WITH numbered AS (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY university_id ORDER BY name_tr) as rn
                FROM university_departments
            )
            UPDATE university_departments 
            SET sort_order = numbered.rn
            FROM numbered
            WHERE university_departments.id = numbered.id
        `);
        console.log('   ✅ Sıra numaraları atandı\n');

        // 3. Index ekle
        console.log('3️⃣  Index ekleniyor...');
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_university_departments_sort_order 
            ON university_departments(university_id, sort_order)
        `);
        console.log('   ✅ Index eklendi\n');

        // 4. Sonuçları kontrol et
        const result = await pool.query(`
            SELECT u.name as university, ud.name_tr as department, ud.sort_order
            FROM university_departments ud
            JOIN universities u ON u.id = ud.university_id
            ORDER BY u.name, ud.sort_order
            LIMIT 20
        `);
        
        console.log('📋 Örnek sıralama:');
        result.rows.forEach(row => {
            console.log(`   ${row.university}: ${row.department} (sıra: ${row.sort_order})`);
        });

        console.log('\n✅ Migration başarıyla tamamlandı!');
        
    } catch (error) {
        console.error('❌ Migration hatası:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

runMigration();


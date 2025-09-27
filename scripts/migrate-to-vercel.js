#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Environment variables kontrol
if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable bulunamadı!');
    console.log('💡 Vercel Dashboard > Settings > Environment Variables ekleyin');
    process.exit(1);
}

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function migrateToVercel() {
    try {
        console.log('🚀 Vercel Postgres migration başlatılıyor...');
        
        // Schema dosyasını oku
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema dosyası bulunamadı: ${schemaPath}`);
        }
        
        const schema = fs.readFileSync(schemaPath, 'utf8');
        console.log('📖 Schema dosyası okundu');
        
        // Database'e bağlan
        const client = await pool.connect();
        console.log('🔗 Database bağlantısı kuruldu');
        
        // Schema'yı çalıştır
        await client.query(schema);
        console.log('✅ Schema başarıyla import edildi');
        
        // Test query
        const result = await client.query('SELECT NOW() as current_time');
        console.log('🕐 Database time:', result.rows[0].current_time);
        
        client.release();
        console.log('🎉 Migration tamamlandı!');
        
    } catch (error) {
        console.error('❌ Migration hatası:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Script çalıştır
if (require.main === module) {
    migrateToVercel();
}

module.exports = { migrateToVercel };

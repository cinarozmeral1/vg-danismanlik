const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function addTestPartners() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Adding test partners...\n');
        
        // Test partner 1
        const password1 = await bcrypt.hash('test123', 10);
        const partner1 = await client.query(`
            INSERT INTO partners (email, password_hash, first_name, last_name, phone, company_name, email_verified)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
            RETURNING id, email, first_name, last_name;
        `, ['ahmet.yilmaz@test.com', password1, 'Ahmet', 'Yılmaz', '+90 532 111 2233', 'Yılmaz Eğitim Danışmanlık', true]);
        console.log('✅ Partner 1 eklendi:', partner1.rows[0]);
        
        // Test partner 2
        const password2 = await bcrypt.hash('test123', 10);
        const partner2 = await client.query(`
            INSERT INTO partners (email, password_hash, first_name, last_name, phone, company_name, email_verified)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
            RETURNING id, email, first_name, last_name;
        `, ['elif.kaya@test.com', password2, 'Elif', 'Kaya', '+90 533 444 5566', 'Kaya Education', true]);
        console.log('✅ Partner 2 eklendi:', partner2.rows[0]);
        
        console.log('\n📋 Test Partner Giriş Bilgileri:');
        console.log('─'.repeat(50));
        console.log('Partner 1: ahmet.yilmaz@test.com / test123');
        console.log('Partner 2: elif.kaya@test.com / test123');
        console.log('─'.repeat(50));
        
        console.log('\n🎉 Test partnerleri başarıyla eklendi!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

addTestPartners().catch(console.error);


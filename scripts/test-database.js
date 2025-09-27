#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');

// Database connection test
async function testDatabase() {
    console.log('🧪 Database bağlantı testi başlatılıyor...\n');
    
    // Environment variables kontrol
    console.log('📋 Environment Variables:');
    console.log('NODE_ENV:', process.env.NODE_ENV || 'Not set');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Not set');
    console.log('POSTGRES_CA_CERT:', process.env.POSTGRES_CA_CERT ? '✅ Set' : '❌ Not set');
    console.log('POSTGRES_CLIENT_KEY:', process.env.POSTGRES_CLIENT_KEY ? '✅ Set' : '❌ Not set');
    console.log('POSTGRES_CLIENT_CERT:', process.env.POSTGRES_CLIENT_CERT ? '✅ Set' : '❌ Not set');
    console.log('');
    
    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL bulunamadı!');
        console.log('💡 Vercel Dashboard > Settings > Environment Variables ekleyin');
        return;
    }
    
    // Database connection test
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? {
            rejectUnauthorized: false,
            ca: process.env.POSTGRES_CA_CERT,
            key: process.env.POSTGRES_CLIENT_KEY,
            cert: process.env.POSTGRES_CLIENT_CERT
        } : false
    });
    
    try {
        console.log('🔗 Database bağlantısı kuruluyor...');
        const client = await pool.connect();
        console.log('✅ Database bağlantısı başarılı!');
        
        // Test queries
        console.log('\n📊 Test Queries:');
        
        // Current time
        const timeResult = await client.query('SELECT NOW() as current_time');
        console.log('🕐 Current time:', timeResult.rows[0].current_time);
        
        // Database version
        const versionResult = await client.query('SELECT version()');
        console.log('📚 PostgreSQL version:', versionResult.rows[0].version.split(' ')[1]);
        
        // Database name
        const dbResult = await client.query('SELECT current_database() as db_name');
        console.log('🗄️ Database name:', dbResult.rows[0].db_name);
        
        // Connection info
        const connResult = await client.query('SELECT inet_server_addr() as host, inet_server_port() as port');
        console.log('🌐 Host:', connResult.rows[0].host);
        console.log('🔌 Port:', connResult.rows[0].port);
        
        client.release();
        console.log('\n🎉 Tüm testler başarılı!');
        
    } catch (error) {
        console.error('\n❌ Database test hatası:', error.message);
        console.error('Stack:', error.stack);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Çözüm önerileri:');
            console.log('1. DATABASE_URL doğru mu?');
            console.log('2. Database çalışıyor mu?');
            console.log('3. Firewall ayarları?');
        }
        
        if (error.code === '28P01') {
            console.log('\n💡 Çözüm önerileri:');
            console.log('1. Username/password doğru mu?');
            console.log('2. Database permissions?');
        }
        
    } finally {
        await pool.end();
    }
}

// Script çalıştır
if (require.main === module) {
    testDatabase();
}

module.exports = { testDatabase };

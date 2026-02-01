// Test kullanıcıları ekleme scripti
// Reklam videosu için 5 test kullanıcı

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Türkiye'nin en popüler isimleri ile test kullanıcıları
const testUsers = [
    {
        first_name: 'Mehmet',
        last_name: 'Yılmaz',
        email: 'mehmet.yilmaz@test.com',
        phone: '+90 532 123 4567',
        tc_number: '12345678901',
        birth_date: '2005-03-15',
        english_level: 'B1'
    },
    {
        first_name: 'Ayşe',
        last_name: 'Demir',
        email: 'ayse.demir@test.com',
        phone: '+90 533 234 5678',
        tc_number: '23456789012',
        birth_date: '2006-07-22',
        english_level: 'B2'
    },
    {
        first_name: 'Mustafa',
        last_name: 'Kaya',
        email: 'mustafa.kaya@test.com',
        phone: '+90 534 345 6789',
        tc_number: '34567890123',
        birth_date: '2005-11-08',
        english_level: 'A2'
    },
    {
        first_name: 'Fatma',
        last_name: 'Çelik',
        email: 'fatma.celik@test.com',
        phone: '+90 535 456 7890',
        tc_number: '45678901234',
        birth_date: '2006-01-30',
        english_level: 'C1'
    },
    {
        first_name: 'Ali',
        last_name: 'Şahin',
        email: 'ali.sahin@test.com',
        phone: '+90 536 567 8901',
        tc_number: '56789012345',
        birth_date: '2005-09-12',
        english_level: 'B1'
    }
];

async function addTestUsers() {
    console.log('🚀 Test kullanıcıları ekleniyor...\n');
    
    // Ortak şifre: Test123!
    const passwordHash = await bcrypt.hash('Test123!', 12);
    
    for (const user of testUsers) {
        try {
            // Önce kullanıcının var olup olmadığını kontrol et
            const existingUser = await pool.query(
                'SELECT id FROM users WHERE email = $1 OR tc_number = $2',
                [user.email, user.tc_number]
            );
            
            if (existingUser.rows.length > 0) {
                console.log(`⚠️  ${user.first_name} ${user.last_name} zaten mevcut, atlanıyor...`);
                continue;
            }
            
            const result = await pool.query(`
                INSERT INTO users (
                    first_name,
                    last_name,
                    email,
                    tc_number,
                    phone,
                    password_hash,
                    english_level,
                    high_school_graduation_date,
                    birth_date,
                    passport_type,
                    passport_number,
                    desired_country,
                    active_class,
                    registered_via,
                    personal_info_completed,
                    email_verified,
                    created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
                RETURNING id, first_name, last_name, email
            `, [
                user.first_name,
                user.last_name,
                user.email,
                user.tc_number,
                user.phone,
                passwordHash,
                user.english_level,
                '2024-06-15', // high_school_graduation_date
                user.birth_date,
                null, // passport_type
                null, // passport_number
                'İngiltere', // desired_country
                null, // active_class
                'email',
                true, // personal_info_completed
                true  // email_verified
            ]);
            
            console.log(`✅ ${result.rows[0].first_name} ${result.rows[0].last_name} eklendi (ID: ${result.rows[0].id})`);
            console.log(`   📧 Email: ${result.rows[0].email}`);
            console.log(`   📱 Telefon: ${user.phone}`);
            console.log(`   🆔 TC: ${user.tc_number}`);
            console.log('');
            
        } catch (error) {
            console.error(`❌ ${user.first_name} ${user.last_name} eklenirken hata:`, error.message);
        }
    }
    
    console.log('\n📋 Tüm test kullanıcıları:');
    console.log('   Ortak şifre: Test123!');
    console.log('\n🗑️  Silmek için: node database/delete_test_users.js');
    
    await pool.end();
}

addTestUsers();

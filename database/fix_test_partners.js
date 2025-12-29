const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function fixTestPartners() {
    const client = await pool.connect();
    
    try {
        console.log('🔧 Fixing test partners...\n');
        
        // Check existing partners
        const existingPartners = await client.query('SELECT id, email, first_name, last_name, email_verified, is_active, password_hash FROM partners');
        console.log('📋 Existing partners:');
        existingPartners.rows.forEach(p => {
            console.log(`  - ID: ${p.id}, Email: ${p.email}, Name: ${p.first_name} ${p.last_name}, Verified: ${p.email_verified}, Active: ${p.is_active}, Has Password: ${!!p.password_hash}`);
        });
        
        // Update test partner passwords and ensure they're verified and active
        const testPassword = 'test123';
        const hashedPassword = await bcrypt.hash(testPassword, 10);
        
        // Update Ahmet
        await client.query(`
            UPDATE partners 
            SET password_hash = $1, email_verified = true, is_active = true 
            WHERE email = 'ahmet.yilmaz@test.com'
        `, [hashedPassword]);
        console.log('✅ Updated ahmet.yilmaz@test.com');
        
        // Update Elif
        await client.query(`
            UPDATE partners 
            SET password_hash = $1, email_verified = true, is_active = true 
            WHERE email = 'elif.kaya@test.com'
        `, [hashedPassword]);
        console.log('✅ Updated elif.kaya@test.com');
        
        // Verify updates
        const updatedPartners = await client.query('SELECT id, email, first_name, last_name, email_verified, is_active FROM partners');
        console.log('\n📋 Updated partners:');
        updatedPartners.rows.forEach(p => {
            console.log(`  - ID: ${p.id}, Email: ${p.email}, Name: ${p.first_name} ${p.last_name}, Verified: ${p.email_verified}, Active: ${p.is_active}`);
        });
        
        console.log('\n📋 Test Partner Credentials:');
        console.log('─'.repeat(50));
        console.log('Email: ahmet.yilmaz@test.com');
        console.log('Password: test123');
        console.log('─'.repeat(50));
        console.log('Email: elif.kaya@test.com');
        console.log('Password: test123');
        console.log('─'.repeat(50));
        
        console.log('\n🎉 Test partners fixed successfully!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

fixTestPartners().catch(console.error);


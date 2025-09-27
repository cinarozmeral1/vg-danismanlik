const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
});

async function createTestUser() {
    try {
        // Test admin user
        const adminPassword = 'admin123';
        const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
        
        const adminResult = await pool.query(`
            INSERT INTO users (
                first_name, last_name, email, password_hash, 
                tc_number, phone, english_level, is_admin, 
                email_verified, is_active, created_at
            ) VALUES (
                'Admin', 'User', 'admin@test.com', $1,
                '12345678901', '+905551234567', 'Advanced', true,
                true, true, CURRENT_TIMESTAMP
            ) ON CONFLICT (email) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                is_admin = EXCLUDED.is_admin,
                email_verified = EXCLUDED.email_verified
            RETURNING id, email, first_name, last_name, is_admin
        `, [adminPasswordHash]);
        
        console.log('Admin user created/updated:', adminResult.rows[0]);
        
        // Test regular user
        const userPassword = 'user123';
        const userPasswordHash = await bcrypt.hash(userPassword, 10);
        
        const userResult = await pool.query(`
            INSERT INTO users (
                first_name, last_name, email, password_hash, 
                tc_number, phone, english_level, is_admin, 
                email_verified, is_active, created_at
            ) VALUES (
                'Test', 'User', 'user@test.com', $1,
                '98765432109', '+905559876543', 'Intermediate', false,
                true, true, CURRENT_TIMESTAMP
            ) ON CONFLICT (email) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                email_verified = EXCLUDED.email_verified
            RETURNING id, email, first_name, last_name, is_admin
        `, [userPasswordHash]);
        
        console.log('Regular user created/updated:', userResult.rows[0]);
        
        console.log('\nTest credentials:');
        console.log('Admin: admin@test.com / admin123');
        console.log('User: user@test.com / user123');
        
    } catch (error) {
        console.error('Error creating test users:', error);
    } finally {
        await pool.end();
    }
}

createTestUser();

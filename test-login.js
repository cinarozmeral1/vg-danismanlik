const bcrypt = require('bcryptjs');
const pool = require('./config/database');

async function createTestUser() {
    try {
        console.log('🔍 Creating test user...');
        
        // Check if user already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            ['test@example.com']
        );
        
        if (existingUser.rows.length > 0) {
            console.log('✅ Test user already exists');
            return;
        }
        
        // Hash password
        const passwordHash = await bcrypt.hash('123456', 10);
        
        // Create user
        const result = await pool.query(`
            INSERT INTO users (
                first_name, last_name, email, tc_number, phone, password_hash,
                english_level, high_school_graduation_date, birth_date,
                email_verified, is_admin
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id, first_name, email
        `, [
            'Test', 'User', 'test@example.com', '12345678901', '5555555555', passwordHash,
            'B1', '2023-06-15', '2000-01-01', true, false
        ]);
        
        console.log('✅ Test user created:', result.rows[0]);
        
    } catch (error) {
        console.error('❌ Error creating test user:', error);
    }
}

createTestUser();

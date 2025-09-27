require('dotenv').config();
const pool = require('./config/database');

async function createTestUser() {
    try {
        console.log('🔍 Creating test user...');
        
        // Check if test user already exists
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', ['fatma@test.com']);
        
        if (existingUser.rows.length > 0) {
            console.log('✅ Test user already exists');
            return;
        }
        
        // Use the same hash from SQLite
        const passwordHash = '$2b$10$Tloj/06IG7XxzdKnSCuATuV.H9r9T18qztQcMIIwIFpBeRyC95URO';
        
        // Create test user
        const result = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, email_verified, tc_number, phone, english_level, high_school_graduation_date, birth_date, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id`,
            ['Fatma', 'Demir', 'fatma@test.com', passwordHash, true, '88888888888', '05088888888', 'Intermediate', '2025-06-15', '2005-01-01']
        );
        
        console.log('✅ Test user created with ID:', result.rows[0].id);
        
    } catch (error) {
        console.error('❌ Error creating test user:', error.message);
    } finally {
        await pool.end();
    }
}

createTestUser();

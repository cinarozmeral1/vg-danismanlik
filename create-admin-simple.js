const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createAdminUser() {
    try {
        console.log('🔍 Creating admin user...');
        
        // Check if admin already exists
        const existingAdmin = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@ventureglobal.com']);
        
        if (existingAdmin.rows.length > 0) {
            console.log('✅ Admin user already exists');
            return;
        }
        
        // Use the same hash from SQLite
        const passwordHash = '$2b$10$Tloj/06IG7XxzdKnSCuATuV.H9r9T18qztQcMIIwIFpBeRyC95URO';
        
        // Create admin user
        const result = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, is_admin, email_verified, tc_number, phone, english_level, high_school_graduation_date, birth_date, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id`,
            ['Admin', 'User', 'admin@ventureglobal.com', passwordHash, true, true, '12345678901', '05001234567', 'Advanced', '2020-06-15', '1990-01-01']
        );
        
        console.log('✅ Admin user created with ID:', result.rows[0].id);
        
        // Create test users
        const testUsers = [
            { first_name: 'Ahmet', last_name: 'Yılmaz', email: 'ahmet@test.com', tc_number: '11111111112', phone: '05011111111' },
            { first_name: 'Fatma', last_name: 'Demir', email: 'fatma@test.com', tc_number: '22222222223', phone: '05022222222' },
            { first_name: 'Mehmet', last_name: 'Kaya', email: 'mehmet@test.com', tc_number: '33333333334', phone: '05033333333' },
            { first_name: 'Sam', last_name: 'Wilson', email: 'sam@test.com', tc_number: '44444444445', phone: '05044444444' }
        ];
        
        for (const user of testUsers) {
            const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [user.email]);
            
            if (existingUser.rows.length === 0) {
                await pool.query(
                    `INSERT INTO users (first_name, last_name, email, password_hash, is_admin, email_verified, tc_number, phone, english_level, high_school_graduation_date, birth_date, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    [user.first_name, user.last_name, user.email, passwordHash, false, true, user.tc_number, user.phone, 'Intermediate', '2025-06-15', '2005-01-01']
                );
                console.log(`✅ Test user created: ${user.email}`);
            } else {
                console.log(`ℹ️  Test user already exists: ${user.email}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error creating users:', error.message);
    } finally {
        await pool.end();
    }
}

createAdminUser();

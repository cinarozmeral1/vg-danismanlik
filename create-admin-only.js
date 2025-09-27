const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createAdminOnly() {
    try {
        console.log('🔍 Creating admin user only...');
        
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
            ['Admin', 'User', 'admin@ventureglobal.com', passwordHash, true, true, '99999999999', '05009999999', 'Advanced', '2020-06-15', '1990-01-01']
        );
        
        console.log('✅ Admin user created with ID:', result.rows[0].id);
        
    } catch (error) {
        console.error('❌ Error creating admin:', error.message);
    } finally {
        await pool.end();
    }
}

createAdminOnly();

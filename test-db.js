const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testDatabase() {
    try {
        console.log('🔍 Testing PostgreSQL connection...');
        
        // Test connection
        const result = await pool.query('SELECT NOW() as now');
        console.log('✅ Database connection successful:', result.rows[0].now);
        
        // Check users table
        const usersResult = await pool.query('SELECT id, email, first_name, last_name, is_admin, email_verified FROM users LIMIT 5');
        console.log('📊 Users in database:');
        console.table(usersResult.rows);
        
        // Check specific admin user
        const adminResult = await pool.query('SELECT id, email, password_hash, is_admin, email_verified FROM users WHERE email = $1', ['admin@ventureglobal.com']);
        if (adminResult.rows.length > 0) {
            console.log('👤 Admin user found:', {
                id: adminResult.rows[0].id,
                email: adminResult.rows[0].email,
                is_admin: adminResult.rows[0].is_admin,
                email_verified: adminResult.rows[0].email_verified,
                has_password: !!adminResult.rows[0].password_hash
            });
        } else {
            console.log('❌ Admin user not found!');
        }
        
    } catch (error) {
        console.error('❌ Database error:', error.message);
    } finally {
        await pool.end();
    }
}

testDatabase();

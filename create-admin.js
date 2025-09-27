const { Pool } = require('pg');
const bcrypt = require('bcrypt');

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
        
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash('admin123', saltRounds);
        
        // Create admin user
        const result = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password_hash, is_admin, email_verified, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             RETURNING id`,
            ['Admin', 'User', 'admin@ventureglobal.com', passwordHash, true, true]
        );
        
        console.log('✅ Admin user created with ID:', result.rows[0].id);
        
        // Create test users
        const testUsers = [
            { first_name: 'Ahmet', last_name: 'Yılmaz', email: 'ahmet@test.com' },
            { first_name: 'Fatma', last_name: 'Demir', email: 'fatma@test.com' },
            { first_name: 'Mehmet', last_name: 'Kaya', email: 'mehmet@test.com' },
            { first_name: 'Sam', last_name: 'Wilson', email: 'sam@test.com' }
        ];
        
        for (const user of testUsers) {
            const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [user.email]);
            
            if (existingUser.rows.length === 0) {
                await pool.query(
                    `INSERT INTO users (first_name, last_name, email, password_hash, is_admin, email_verified, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    [user.first_name, user.last_name, user.email, passwordHash, false, true]
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

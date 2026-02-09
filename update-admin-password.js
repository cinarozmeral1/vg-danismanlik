const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function updateAdminPassword() {
    try {
        console.log('🔄 Updating admin password...');
        
        // New password
        const newPassword = '1358_Cinar123';
        
        // Hash the new password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(newPassword, saltRounds);
        
        console.log('🔐 Password hashed successfully');
        
        // Update admin user password
        const result = await pool.query(
            `UPDATE users 
             SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE email = $2 AND is_admin = true
             RETURNING id, email, first_name, last_name`,
            [passwordHash, 'admin@ventureglobal.com']
        );
        
        if (result.rows.length > 0) {
            console.log('✅ Admin password updated successfully!');
            console.log('📧 Admin Email:', result.rows[0].email);
            console.log('🔑 New Password: 1358_Cinar123');
        } else {
            console.log('⚠️ Admin user not found. Creating new admin...');
            
            // Create admin if doesn't exist
            const createResult = await pool.query(
                `INSERT INTO users (first_name, last_name, email, password_hash, is_admin, email_verified, tc_number, phone, english_level, high_school_graduation_date, birth_date, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                 RETURNING id, email`,
                ['Admin', 'User', 'admin@ventureglobal.com', passwordHash, true, true, '12345678901', '05001234567', 'Advanced', '2020-06-15', '1990-01-01']
            );
            
            console.log('✅ Admin user created with new password!');
            console.log('📧 Admin Email: admin@ventureglobal.com');
            console.log('🔑 Password: 1358_Cinar123');
        }
        
    } catch (error) {
        console.error('❌ Error updating admin password:', error.message);
    } finally {
        await pool.end();
    }
}

updateAdminPassword();




const fs = require('fs');
const path = require('path');
const pool = require('../config/database');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
    try {
        console.log('🔄 Initializing database...');
        
        // Read schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Execute schema
        await pool.query(schema);
        console.log('✅ Database schema created successfully');
        
        // Create admin user with proper password hash
        const adminPassword = 'admin123';
        const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
        
        await pool.query(`
            INSERT INTO admins (email, password_hash, name) 
            VALUES ($1, $2, $3)
            ON CONFLICT (email) DO UPDATE SET 
            password_hash = EXCLUDED.password_hash
        `, ['admin@ventureglobal.com', adminPasswordHash, 'Venture Global Admin']);
        
        console.log('✅ Admin user created successfully');
        console.log('📧 Admin Email: admin@ventureglobal.com');
        console.log('🔑 Admin Password: admin123');
        
        console.log('🎉 Database initialization completed!');
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
}

// Run initialization if this file is executed directly
if (require.main === module) {
    initializeDatabase()
        .then(() => {
            console.log('✅ Database setup completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Database setup failed:', error);
            process.exit(1);
        });
}

module.exports = { initializeDatabase }; 
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

async function initializeSQLiteDatabase() {
    try {
        console.log('🔄 Initializing SQLite database...');
        
        const dbPath = path.join(__dirname, '..', 'database.sqlite');
        const db = new sqlite3.Database(dbPath);
        
        // Read schema file
        const schemaPath = path.join(__dirname, 'sqlite_schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Execute schema
        await new Promise((resolve, reject) => {
            db.exec(schema, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('✅ SQLite database schema created successfully');
        
        // Create admin user
        const adminPassword = 'admin123';
        const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
        
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT OR REPLACE INTO users (id, first_name, last_name, email, password_hash, is_admin)
                VALUES (1, 'Admin', 'User', 'admin@ventureglobal.com', ?, TRUE)
            `, [adminPasswordHash], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
        
        console.log('✅ Admin user created successfully');
        console.log('📧 Admin Email: admin@ventureglobal.com');
        console.log('🔑 Admin Password: admin123');
        
        // Add test users
        const testUsers = [
            {
                first_name: 'Ahmet',
                last_name: 'Yılmaz',
                email: 'ahmet@test.com',
                phone: '0532 123 4567',
                password: 'test123'
            },
            {
                first_name: 'Fatma',
                last_name: 'Demir',
                email: 'fatma@test.com',
                phone: '0533 234 5678',
                password: 'test123'
            },
            {
                first_name: 'Mehmet',
                last_name: 'Kaya',
                email: 'mehmet@test.com',
                phone: '0534 345 6789',
                password: 'test123'
            },
            {
                first_name: 'Ayşe',
                last_name: 'Özkan',
                email: 'ayse@test.com',
                phone: '0535 456 7890',
                password: 'test123'
            },
            {
                first_name: 'Sam',
                last_name: 'Wilson',
                email: 'sam@test.com',
                phone: '0536 567 8901',
                password: 'test123'
            }
        ];
        
        for (const user of testUsers) {
            const passwordHash = await bcrypt.hash(user.password, 10);
            
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT OR REPLACE INTO users (first_name, last_name, email, phone, password_hash, created_at)
                    VALUES (?, ?, ?, ?, ?, datetime('now'))
                `, [user.first_name, user.last_name, user.email, user.phone, passwordHash], function(err) {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            console.log(`✅ User added: ${user.first_name} ${user.last_name}`);
        }
        
        db.close();
        console.log('🎉 SQLite database initialization completed!');
        
    } catch (error) {
        console.error('❌ SQLite database initialization failed:', error);
        throw error;
    }
}

// Run initialization if this file is executed directly
if (require.main === module) {
    initializeSQLiteDatabase()
        .then(() => {
            console.log('✅ SQLite database setup completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ SQLite database setup failed:', error);
            process.exit(1);
        });
}

module.exports = { initializeSQLiteDatabase };

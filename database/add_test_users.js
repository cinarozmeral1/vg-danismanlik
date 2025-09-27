const pool = require('../config/database');
const bcrypt = require('bcryptjs');

async function addTestUsers() {
    try {
        console.log('🔄 Adding test users...');
        
        // Test users data
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
            
            await pool.query(`
                INSERT INTO users (first_name, last_name, email, phone, password_hash, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                ON CONFLICT (email) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                phone = EXCLUDED.phone,
                password_hash = EXCLUDED.password_hash
            `, [user.first_name, user.last_name, user.email, user.phone, passwordHash]);
            
            console.log(`✅ User added: ${user.first_name} ${user.last_name}`);
        }
        
        console.log('🎉 Test users added successfully!');
        
    } catch (error) {
        console.error('❌ Error adding test users:', error);
        throw error;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    addTestUsers()
        .then(() => {
            console.log('✅ Test users setup completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Test users setup failed:', error);
            process.exit(1);
        });
}

module.exports = { addTestUsers };

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function fixEmailVerification() {
    try {
        console.log('🔄 Fixing email verification status...');
        
        const dbPath = path.join(__dirname, '..', 'database.sqlite');
        const db = new sqlite3.Database(dbPath);
        
        // Tüm kullanıcıların email_verified sütununu TRUE yap
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE users 
                SET email_verified = 1 
                WHERE email_verified = 0 OR email_verified IS NULL
            `, function(err) {
                if (err) reject(err);
                else {
                    console.log(`✅ Updated ${this.changes} users' email verification status`);
                    resolve();
                }
            });
        });
        
        // Kontrol et
        await new Promise((resolve, reject) => {
            db.all(`
                SELECT email, email_verified, is_admin 
                FROM users 
                ORDER BY is_admin DESC, email
            `, (err, rows) => {
                if (err) reject(err);
                else {
                    console.log('📋 User verification status:');
                    rows.forEach(row => {
                        const status = row.email_verified ? '✅ Verified' : '❌ Not Verified';
                        const admin = row.is_admin ? ' (Admin)' : '';
                        console.log(`  ${row.email} - ${status}${admin}`);
                    });
                    resolve();
                }
            });
        });
        
        db.close();
        console.log('🎉 Email verification fix completed!');
        
    } catch (error) {
        console.error('❌ Error fixing email verification:', error);
        throw error;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    fixEmailVerification()
        .then(() => {
            console.log('✅ Email verification fix completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Email verification fix failed:', error);
            process.exit(1);
        });
}

module.exports = { fixEmailVerification };

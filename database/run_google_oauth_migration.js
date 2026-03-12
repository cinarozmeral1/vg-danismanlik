const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function runMigration() {
    try {
        console.log('🚀 Starting Google OAuth migration...');
        
        const sqlPath = path.join(__dirname, 'add_google_oauth_fields.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Split SQL into individual statements
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        
        for (const statement of statements) {
            if (statement.length > 0) {
                console.log(`📝 Executing: ${statement.substring(0, 60)}...`);
                try {
                    await pool.query(statement);
                    console.log('✅ Success');
                } catch (err) {
                    // Ignore "already exists" errors
                    if (err.message.includes('already exists') || err.code === '42701') {
                        console.log('⚠️ Already exists, skipping...');
                    } else {
                        throw err;
                    }
                }
            }
        }
        
        console.log('\n✅ Google OAuth migration completed successfully!');
        
        // Verify columns exist
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name IN ('google_id', 'registered_via', 'personal_info_completed')
        `);
        
        console.log('\n📊 New columns verified:');
        result.rows.forEach(row => {
            console.log(`   - ${row.column_name}: ${row.data_type}`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();































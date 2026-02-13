const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        console.log('🚀 Running application_deadline migration...');
        
        const sql = fs.readFileSync(path.join(__dirname, 'add_application_deadline.sql'), 'utf8');
        await pool.query(sql);
        
        console.log('✅ application_deadline column added successfully (or already exists)');
        
        // Verify the column exists
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'universities' AND column_name = 'application_deadline'
        `);
        
        if (result.rows.length > 0) {
            console.log('✅ Verified: application_deadline column exists with type:', result.rows[0].data_type);
        } else {
            console.log('❌ Warning: Column verification failed');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration error:', error.message);
        process.exit(1);
    }
}

runMigration();


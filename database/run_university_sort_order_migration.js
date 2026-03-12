// Run University Sort Order Migration
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    try {
        console.log('🚀 Running university sort_order migration...');
        
        const sqlPath = path.join(__dirname, 'add_university_sort_order.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        await pool.query(sql);
        
        console.log('✅ Migration completed successfully!');
        
        // Verify the column was added
        const result = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'universities' AND column_name = 'sort_order'
        `);
        
        if (result.rows.length > 0) {
            console.log('✅ sort_order column exists in universities table');
        } else {
            console.log('❌ sort_order column was not created');
        }
        
        // Show current universities with sort_order
        const universities = await pool.query('SELECT id, name, sort_order FROM universities ORDER BY sort_order');
        console.log('📋 Universities with sort_order:');
        universities.rows.forEach(u => {
            console.log(`   ${u.sort_order}. ${u.name} (ID: ${u.id})`);
        });
        
    } catch (error) {
        console.error('❌ Migration error:', error.message);
    } finally {
        await pool.end();
    }
}

runMigration();










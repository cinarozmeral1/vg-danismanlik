// Run blog tables migration
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    try {
        console.log('🚀 Starting blog tables migration...');
        
        const sqlPath = path.join(__dirname, 'add_blog_tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        await pool.query(sql);
        
        console.log('✅ Blog tables created successfully!');
        
        // Verify tables exist
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('blog_posts', 'blog_topic_history')
        `);
        
        console.log('📋 Created tables:', tables.rows.map(r => r.table_name).join(', '));
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

runMigration();


// Migration: Add sort_order to universities table
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Starting university sort_order migration...\n');
        
        // Add sort_order column
        console.log('📋 Adding sort_order column to universities table...');
        await client.query(`
            ALTER TABLE universities ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
        `);
        console.log('✅ sort_order column added\n');
        
        // Set initial sort order based on current ID order
        console.log('📋 Setting initial sort order...');
        await client.query(`
            WITH ranked AS (
                SELECT id, ROW_NUMBER() OVER (ORDER BY is_featured DESC, world_ranking ASC NULLS LAST, id ASC) as rn
                FROM universities
            )
            UPDATE universities u
            SET sort_order = r.rn
            FROM ranked r
            WHERE u.id = r.id;
        `);
        console.log('✅ Initial sort order set\n');
        
        // Create index for faster sorting
        console.log('📋 Creating index...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_universities_sort_order ON universities(sort_order);
        `);
        console.log('✅ Index created\n');
        
        // Verify
        const result = await client.query('SELECT id, name, sort_order FROM universities ORDER BY sort_order LIMIT 10');
        console.log('📊 First 10 universities by sort order:');
        result.rows.forEach(r => console.log(`  ${r.sort_order}. ${r.name}`));
        
        console.log('\n🎉 Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();







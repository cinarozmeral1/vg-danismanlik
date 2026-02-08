// Migration: Add student_partners table for multi-partner assignment
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Starting student_partners migration...\n');
        
        // Create student_partners table
        console.log('📋 Creating student_partners table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS student_partners (
                id SERIAL PRIMARY KEY,
                student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                UNIQUE(student_id, partner_id)
            );
        `);
        console.log('✅ student_partners table created\n');
        
        // Create indexes
        console.log('📋 Creating indexes...');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_student_partners_student ON student_partners(student_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_student_partners_partner ON student_partners(partner_id);`);
        console.log('✅ Indexes created\n');
        
        // Migrate existing partner_id assignments from users table
        console.log('📋 Migrating existing partner assignments...');
        const existingAssignments = await client.query(`
            SELECT id, partner_id FROM users WHERE partner_id IS NOT NULL
        `);
        
        for (const user of existingAssignments.rows) {
            await client.query(`
                INSERT INTO student_partners (student_id, partner_id, notes)
                VALUES ($1, $2, 'Migrated from users.partner_id')
                ON CONFLICT (student_id, partner_id) DO NOTHING
            `, [user.id, user.partner_id]);
        }
        console.log(`✅ Migrated ${existingAssignments.rows.length} existing assignments\n`);
        
        // Verify
        const count = await client.query('SELECT COUNT(*) FROM student_partners');
        console.log(`📊 Total student_partners records: ${count.rows[0].count}\n`);
        
        console.log('🎉 Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();











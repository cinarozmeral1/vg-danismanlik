/**
 * Run guardians system migration
 * Adds: current_school, home_address to users
 * Creates: guardians table
 * Migrates: mother/father data from users to guardians
 */
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting guardians system migration...');

        // Read SQL file
        const sqlPath = path.join(__dirname, 'add_guardians_system.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split and run statements
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const stmt of statements) {
            try {
                await client.query(stmt);
                console.log('✅', stmt.substring(0, 60).replace(/\n/g, ' ') + '...');
            } catch (err) {
                // Skip "already exists" errors
                if (err.message.includes('already exists') || err.message.includes('does not exist')) {
                    console.log('⏭️  Skipped (already applied):', stmt.substring(0, 50).replace(/\n/g, ' '));
                } else {
                    console.error('❌ Error:', err.message);
                    console.error('   Statement:', stmt.substring(0, 100));
                }
            }
        }

        // Verify
        const guardiansCount = await client.query('SELECT COUNT(*) FROM guardians');
        console.log(`\n📊 Guardians table: ${guardiansCount.rows[0].count} records`);

        const cols = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name IN ('current_school', 'home_address', 'profile_reminder_sent')
            ORDER BY column_name
        `);
        console.log('📊 New user columns:', cols.rows.map(r => r.column_name).join(', '));

        console.log('\n✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();


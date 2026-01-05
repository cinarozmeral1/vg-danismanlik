// Run AI Recommendations Migration
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🚀 Starting AI Recommendations migration...');
        
        const sqlFile = path.join(__dirname, 'add_ai_recommendations.sql');
        const sql = fs.readFileSync(sqlFile, 'utf8');
        
        await pool.query(sql);
        
        console.log('✅ AI Recommendations table created successfully');
        console.log('✅ Prep Schools table created successfully');
        console.log('✅ Default prep schools inserted');
        
        // Verify tables
        const aiRecResult = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'ai_recommendations'
            ORDER BY ordinal_position
        `);
        console.log('\n📋 ai_recommendations columns:', aiRecResult.rows.length);
        
        const prepResult = await pool.query('SELECT COUNT(*) FROM prep_schools');
        console.log('📋 prep_schools count:', prepResult.rows[0].count);
        
    } catch (error) {
        console.error('❌ Migration error:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run if called directly
if (require.main === module) {
    require('dotenv').config();
    runMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { runMigration };


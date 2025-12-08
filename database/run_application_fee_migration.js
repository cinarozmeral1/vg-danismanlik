const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Starting application fee migration...');
        
        const sqlPath = path.join(__dirname, 'add_application_fee.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        await client.query(sql);
        
        console.log('✅ Migration completed successfully!');
        console.log('📋 Added columns:');
        console.log('   - application_fee_paid (BOOLEAN)');
        console.log('   - application_fee_amount (DECIMAL)');
        console.log('   - application_fee_currency (VARCHAR)');
        console.log('   - application_fee_payment_date (TIMESTAMP)');
        console.log('   - notes (TEXT)');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();


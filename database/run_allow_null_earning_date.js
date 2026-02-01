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
        console.log('Running migration to allow NULL earning_date...');
        
        // Allow NULL for earning_date
        await client.query('ALTER TABLE partner_earnings ALTER COLUMN earning_date DROP NOT NULL');
        console.log('✓ earning_date column now allows NULL values');
        
        // Also allow NULL for payment_date if it has NOT NULL constraint
        try {
            await client.query('ALTER TABLE partner_earnings ALTER COLUMN payment_date DROP NOT NULL');
            console.log('✓ payment_date column now allows NULL values');
        } catch (e) {
            console.log('payment_date already allows NULL or does not exist');
        }
        
        // Verify
        const result = await client.query(`
            SELECT column_name, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'partner_earnings' AND column_name IN ('earning_date', 'payment_date')
        `);
        console.log('Column status:', result.rows);
        
        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(console.error);

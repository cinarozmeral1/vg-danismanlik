/**
 * Run GoPay Migration
 * This script migrates the database from Stripe to GoPay
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Create PostgreSQL connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
});

async function runMigration() {
    console.log('🔄 Starting GoPay migration...');
    
    try {
        // Test database connection
        await pool.query('SELECT NOW()');
        console.log('✅ PostgreSQL database connection successful');
        
        // Read migration SQL file
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'migrate_to_gopay.sql'),
            'utf8'
        );
        
        // Execute migration
        await pool.query(migrationSQL);
        
        console.log('✅ GoPay migration completed successfully!');
        console.log('✅ Changes made:');
        console.log('   - Removed Wise transfer columns (wise_transferred, wise_transfer_date, wise_transfer_notes)');
        console.log('   - Removed Stripe columns (stripe_payment_intent_id, stripe_payment_status)');
        console.log('   - Added GoPay columns (gopay_payment_id, gopay_payment_status)');
        console.log('   - Updated payment_logs table for GoPay compatibility');
        console.log('   - Created indexes for performance');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run migration
runMigration()
    .then(() => {
        console.log('\n✅ Migration script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Migration script failed:', error);
        process.exit(1);
    });


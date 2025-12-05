const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database configuration
const pool = require('../config/database');

async function runMigration() {
    try {
        console.log('🔄 Starting payment features migration...');
        
        // Read the migration SQL file
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'add_payment_features.sql'),
            'utf8'
        );
        
        // Execute the migration
        await pool.query(migrationSQL);
        
        console.log('✅ Payment features migration completed successfully!');
        console.log('✅ Added columns to services table:');
        console.log('   - stripe_payment_intent_id');
        console.log('   - stripe_payment_status');
        console.log('   - payment_method');
        console.log('   - transaction_id');
        console.log('   - paid_amount');
        console.log('   - paid_currency');
        console.log('   - wise_transferred');
        console.log('   - wise_transfer_date');
        console.log('   - wise_transfer_notes');
        console.log('✅ Created payment_logs table');
        console.log('✅ Created indexes for performance');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();


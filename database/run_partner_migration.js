const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🚀 Starting Partner System Migration...\n');
        
        // Step 1: Create partners table
        console.log('📋 Creating partners table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS partners (
                id SERIAL PRIMARY KEY,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                first_name VARCHAR(50) NOT NULL,
                last_name VARCHAR(50) NOT NULL,
                phone VARCHAR(20),
                company_name VARCHAR(200),
                email_verified BOOLEAN DEFAULT FALSE,
                verification_token VARCHAR(255),
                reset_token VARCHAR(255),
                reset_token_expires TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Partners table created\n');
        
        // Step 2: Add partner_id to users table
        console.log('📋 Adding partner_id column to users table...');
        await client.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS partner_id INTEGER REFERENCES partners(id) ON DELETE SET NULL;
        `);
        console.log('✅ partner_id column added to users\n');
        
        // Step 3: Create partner_earnings table
        console.log('📋 Creating partner_earnings table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS partner_earnings (
                id SERIAL PRIMARY KEY,
                partner_id INTEGER REFERENCES partners(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
                earning_date DATE NOT NULL,
                is_paid BOOLEAN DEFAULT FALSE,
                payment_date DATE,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Partner_earnings table created\n');
        
        // Step 4: Create indexes
        console.log('📋 Creating indexes...');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_partners_email ON partners(email);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_partners_verification_token ON partners(verification_token);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_partner_earnings_partner_id ON partner_earnings(partner_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_partner_earnings_user_id ON partner_earnings(user_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_partner_id ON users(partner_id);`);
        console.log('✅ Indexes created\n');
        
        // Verify tables
        console.log('📊 Verifying tables...');
        const tablesCheck = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('partners', 'partner_earnings');
        `);
        console.log('Found tables:', tablesCheck.rows.map(r => r.table_name).join(', '));
        
        // Check users table has partner_id
        const columnCheck = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'partner_id';
        `);
        if (columnCheck.rows.length > 0) {
            console.log('✅ users.partner_id column exists\n');
        }
        
        console.log('🎉 Partner System Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration error:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(console.error);

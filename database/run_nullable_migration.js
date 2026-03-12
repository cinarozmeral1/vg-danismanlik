// Run migration to make user fields nullable
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    console.log('🚀 Starting nullable fields migration...');
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        // Run each ALTER TABLE separately to avoid transaction issues
        const alterStatements = [
            'ALTER TABLE users ALTER COLUMN tc_number DROP NOT NULL',
            'ALTER TABLE users ALTER COLUMN phone DROP NOT NULL',
            'ALTER TABLE users ALTER COLUMN high_school_graduation_date DROP NOT NULL',
            'ALTER TABLE users ALTER COLUMN birth_date DROP NOT NULL',
            'ALTER TABLE users ALTER COLUMN english_level DROP NOT NULL'
        ];

        for (const sql of alterStatements) {
            try {
                await pool.query(sql);
                console.log('✅', sql.substring(0, 60) + '...');
            } catch (err) {
                if (err.message.includes('does not exist') || err.message.includes('not found')) {
                    console.log('⚠️ Column constraint already dropped or does not exist');
                } else {
                    console.log('⚠️ Warning:', err.message);
                }
            }
        }

        // Update existing placeholder values to NULL
        console.log('\n🔄 Updating placeholder values to NULL...');
        
        // Update TC numbers that look like placeholders (small numbers with leading zeros)
        const tcResult = await pool.query(`
            UPDATE users 
            SET tc_number = NULL 
            WHERE tc_number IS NOT NULL 
            AND LENGTH(tc_number) = 11
            AND tc_number ~ '^[0-9]+$'
            AND CAST(tc_number AS BIGINT) < 10000000000
        `);
        console.log('   Updated', tcResult.rowCount, 'TC numbers to NULL');

        // Update placeholder dates
        const dateResult = await pool.query(`
            UPDATE users 
            SET high_school_graduation_date = NULL, birth_date = NULL
            WHERE (high_school_graduation_date = '2000-01-01' OR birth_date = '2000-01-01')
            AND registered_via IN ('email', 'google')
        `);
        console.log('   Updated', dateResult.rowCount, 'users with placeholder dates');

        // Update placeholder text
        const textResult = await pool.query(`
            UPDATE users 
            SET english_level = NULL 
            WHERE english_level = 'Belirtilmedi'
        `);
        console.log('   Updated', textResult.rowCount, 'users with placeholder english_level');

        console.log('\n✅ Migration completed successfully!');
        
        // Show sample of updated users
        const sample = await pool.query(`
            SELECT id, email, tc_number, phone, birth_date, english_level, registered_via 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        console.log('\n📋 Sample users after migration:');
        console.table(sample.rows);

    } catch (error) {
        console.error('❌ Migration error:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

runMigration().catch(console.error);





























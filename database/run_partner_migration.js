const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function runPartnerMigration() {
    console.log('🚀 Starting Partner System Migration...');
    
    try {
        // Read the SQL file
        const sqlPath = path.join(__dirname, 'add_partner_system.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Split by semicolon and execute each statement
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        
        console.log(`📝 Found ${statements.length} SQL statements to execute`);
        
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.trim()) {
                try {
                    await pool.query(statement);
                    console.log(`✅ Statement ${i + 1}/${statements.length} executed successfully`);
                } catch (error) {
                    // Ignore "already exists" errors
                    if (error.message.includes('already exists') || 
                        error.message.includes('duplicate key') ||
                        error.code === '42P07' || // relation already exists
                        error.code === '42710') { // object already exists
                        console.log(`⏭️  Statement ${i + 1}/${statements.length} skipped (already exists)`);
                    } else {
                        console.error(`❌ Statement ${i + 1}/${statements.length} failed:`, error.message);
                        console.error('Statement:', statement.substring(0, 100) + '...');
                    }
                }
            }
        }
        
        // Verify tables were created
        console.log('\n📊 Verifying tables...');
        
        const partnersCheck = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'partners'
            ORDER BY ordinal_position
        `);
        
        if (partnersCheck.rows.length > 0) {
            console.log('✅ Partners table exists with columns:', partnersCheck.rows.map(r => r.column_name).join(', '));
        } else {
            console.log('❌ Partners table not found');
        }
        
        const earningsCheck = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'partner_earnings'
            ORDER BY ordinal_position
        `);
        
        if (earningsCheck.rows.length > 0) {
            console.log('✅ Partner_earnings table exists with columns:', earningsCheck.rows.map(r => r.column_name).join(', '));
        } else {
            console.log('❌ Partner_earnings table not found');
        }
        
        // Check if partner_id column exists in users
        const usersPartnerCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'partner_id'
        `);
        
        if (usersPartnerCheck.rows.length > 0) {
            console.log('✅ Users table has partner_id column');
        } else {
            console.log('❌ Users table missing partner_id column');
        }
        
        console.log('\n🎉 Partner System Migration completed!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run migration
runPartnerMigration()
    .then(() => {
        console.log('Migration script finished');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration script failed:', error);
        process.exit(1);
    });


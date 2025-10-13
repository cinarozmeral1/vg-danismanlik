// Migration script to add file_data column to user_documents table
require('dotenv').config();
const pool = require('../config/database');

async function migrate() {
    try {
        console.log('🔄 Starting migration: Adding file_data column to user_documents...');
        
        // Add file_data column
        await pool.query(`
            ALTER TABLE user_documents 
            ADD COLUMN IF NOT EXISTS file_data TEXT;
        `);
        console.log('✅ Added file_data column');
        
        // Make file_path nullable
        await pool.query(`
            ALTER TABLE user_documents 
            ALTER COLUMN file_path DROP NOT NULL;
        `);
        console.log('✅ Made file_path nullable');
        
        // Update existing records
        await pool.query(`
            UPDATE user_documents 
            SET file_path = '' 
            WHERE file_path IS NULL;
        `);
        console.log('✅ Updated existing records');
        
        // Verify the changes
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'user_documents' 
            AND column_name IN ('file_data', 'file_path');
        `);
        
        console.log('\n📊 Current schema:');
        result.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
        });
        
        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();


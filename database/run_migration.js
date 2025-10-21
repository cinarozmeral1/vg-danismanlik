const pool = require('../config/database');

async function runMigration() {
    try {
        console.log('🔄 Running migration to remove category constraint...');
        
        // Drop the existing constraint
        await pool.query('ALTER TABLE user_documents DROP CONSTRAINT IF EXISTS user_documents_category_check');
        console.log('✅ Dropped category constraint');
        
        // Make category column nullable
        await pool.query('ALTER TABLE user_documents ALTER COLUMN category DROP NOT NULL');
        console.log('✅ Made category column nullable');
        
        console.log('🎉 Migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

runMigration();

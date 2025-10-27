require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://neondb_owner:npg_Sd7p4ULFtBmx@ep-snowy-sound-ad15kvuj-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    console.log('🔄 Running migration to remove passport type constraint...');
    try {
        await pool.query('BEGIN');
        await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_passport_type_check;');
        console.log('✅ Dropped passport type constraint');
        await pool.query('COMMIT');
        console.log('🎉 Migration completed successfully!');
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('❌ Migration failed:', error);
    } finally {
        await pool.end();
    }
}

pool.query('SELECT NOW() as now', (err, result) => {
    if (err) {
        console.log('❌ Database bağlantı hatası:', err.message);
    } else {
        console.log('✅ PostgreSQL database bağlantısı başarılı');
        runMigration();
    }
});

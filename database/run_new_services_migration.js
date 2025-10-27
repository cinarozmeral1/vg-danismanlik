require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://neondb_owner:npg_Sd7p4ULFtBmx@ep-snowy-sound-ad15kvuj-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function runMigration() {
    console.log('🔄 Running migration to create new services table...');
    try {
        await pool.query('BEGIN');
        
        // Drop existing tables
        await pool.query('DROP TABLE IF EXISTS installments CASCADE;');
        console.log('✅ Dropped installments table');
        
        await pool.query('DROP TABLE IF EXISTS services CASCADE;');
        console.log('✅ Dropped old services table');
        
        // Create new simplified services table
        await pool.query(`
            CREATE TABLE services (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                service_name VARCHAR(200) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
                due_date DATE,
                payment_date DATE,
                is_paid BOOLEAN DEFAULT FALSE,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created new services table');
        
        // Create indexes
        await pool.query('CREATE INDEX idx_services_user_id ON services(user_id);');
        await pool.query('CREATE INDEX idx_services_due_date ON services(due_date);');
        await pool.query('CREATE INDEX idx_services_is_paid ON services(is_paid);');
        console.log('✅ Created indexes');
        
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

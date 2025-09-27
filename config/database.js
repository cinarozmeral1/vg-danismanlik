const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://neondb_owner:npg_Sd7p4ULFtBmx@ep-snowy-sound-ad15kvuj-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

// Test database connection
pool.query('SELECT NOW() as now', (err, result) => {
    if (err) {
        console.log('❌ Database bağlantı hatası:', err.message);
    } else {
        console.log('✅ PostgreSQL database bağlantısı başarılı');
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    pool.end();
    process.exit(0);
});

module.exports = pool; 
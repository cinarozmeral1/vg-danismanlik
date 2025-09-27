const { Pool } = require('pg');

// PostgreSQL connection
const pool = new Pool({
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST,
    database: process.env.POSTGRES_DATABASE,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT || 5432,
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
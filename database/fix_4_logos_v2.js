// Apple Touch Icons - yüksek çözünürlüklü (180x180)
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const updates = [
    {
        name: 'University of Manchester',
        logo_url: 'https://www.manchester.ac.uk/apple-touch-icon.png'
    },
    {
        name: 'University of Edinburgh',
        logo_url: 'https://www.ed.ac.uk/apple-touch-icon.png'
    },
    {
        name: 'University of Winchester',
        logo_url: 'https://www.winchester.ac.uk/apple-touch-icon.png'
    },
    {
        name: 'King\'s College London',
        logo_url: 'https://www.kcl.ac.uk/apple-touch-icon.png'
    }
];

async function fix() {
    console.log('🔧 Apple Touch Icons...\n');
    
    for (const uni of updates) {
        console.log(`📝 ${uni.name}: ${uni.logo_url}`);
        await pool.query(`UPDATE universities SET logo_url = $1 WHERE name = $2 AND country = 'UK'`, [uni.logo_url, uni.name]);
    }
    
    console.log('\n✅ Tamamlandı!');
    await pool.end();
}

fix();




















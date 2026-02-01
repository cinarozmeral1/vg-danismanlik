// Final Logo Fix - Wikipedia Commons PNG
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

// Google Favicon API - Her zaman çalışır (128px)
const updates = [
    {
        name: 'University of Manchester',
        logo_url: 'https://www.google.com/s2/favicons?domain=manchester.ac.uk&sz=128'
    },
    {
        name: 'University of Westminster', 
        logo_url: 'https://www.google.com/s2/favicons?domain=westminster.ac.uk&sz=128'
    },
    {
        name: 'Regent\'s University London',
        logo_url: 'https://www.google.com/s2/favicons?domain=regents.ac.uk&sz=128'
    },
    {
        name: 'University of Winchester',
        logo_url: 'https://www.google.com/s2/favicons?domain=winchester.ac.uk&sz=128'
    },
    {
        name: 'Cardiff University',
        logo_url: 'https://www.google.com/s2/favicons?domain=cardiff.ac.uk&sz=128'
    },
    {
        name: 'London School of Economics and Political Science (LSE)',
        logo_url: 'https://www.google.com/s2/favicons?domain=lse.ac.uk&sz=128'
    },
    {
        name: 'University of Edinburgh',
        logo_url: 'https://www.google.com/s2/favicons?domain=ed.ac.uk&sz=128'
    },
    {
        name: 'King\'s College London',
        logo_url: 'https://www.google.com/s2/favicons?domain=kcl.ac.uk&sz=128'
    },
    {
        name: 'University of Sussex',
        logo_url: 'https://www.google.com/s2/favicons?domain=sussex.ac.uk&sz=128'
    }
];

async function fix() {
    console.log('🔧 Logolar düzeltiliyor...\n');
    
    try {
        for (const uni of updates) {
            console.log(`📝 ${uni.name}: ${uni.logo_url}`);
            
            await pool.query(`
                UPDATE universities 
                SET logo_url = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE name = $2 AND country = 'UK'
            `, [uni.logo_url, uni.name]);
        }
        
        console.log('\n✅ Tamamlandı!');
        
    } catch (error) {
        console.error('❌ Hata:', error);
    } finally {
        await pool.end();
    }
}

fix();

